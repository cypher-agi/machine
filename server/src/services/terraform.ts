import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface TerraformVars {
  [key: string]: string | number | boolean | string[];
}

export interface TerraformResult {
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  logs: string[];
}

export type LogCallback = (log: { level: string; message: string; source: string }) => void;

// Base directory for terraform workspaces
const WORKSPACES_DIR = path.join(process.cwd(), '.terraform-workspaces');

function resolveTerraformModulesDir(): string | null {
  // Allow explicit override for unusual deployments
  const envDir = process.env.TERRAFORM_MODULES_DIR;
  if (envDir && envDir.trim() && fs.existsSync(envDir.trim())) {
    return envDir.trim();
  }

  // Try a few common layouts:
  // - dev (tsx): server/src/services -> server/src/terraform/modules
  // - docker/prod: node server/dist/index.js, __dirname=server/dist/services -> server/src/terraform/modules
  // - alternative: modules copied into dist (server/dist/terraform/modules)
  const candidates = [
    // When cwd is repo root (/app or C:\dev\machine)
    path.join(process.cwd(), 'server', 'src', 'terraform', 'modules'),
    // When cwd is server directory (/app/server)
    path.join(process.cwd(), 'src', 'terraform', 'modules'),
    // Relative to this file (dev)
    path.join(__dirname, '..', 'terraform', 'modules'),
    // Relative to this file (docker/prod)
    path.join(__dirname, '..', '..', 'src', 'terraform', 'modules'),
    // If we ever copy modules into dist
    path.join(__dirname, '..', 'terraform', 'modules'),
    path.join(__dirname, '..', '..', 'terraform', 'modules'),
  ];

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        return dir;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

type TerraformResolution =
  | { available: true; command: string; source: 'env' | 'path' | 'winget'; note?: string }
  | { available: false; command?: string; note?: string };

let TERRAFORM_RESOLUTION: TerraformResolution | null = null;

function canExecuteTerraform(command: string): boolean {
  try {
    // Use execFile-style invocation where possible; on Windows a full path may include spaces.
    execSync(`"${command}" --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function tryResolveTerraform(): TerraformResolution {
  // 1) Explicit override
  const envBin = process.env.TERRAFORM_BIN;
  if (envBin && envBin.trim()) {
    const cmd = envBin.trim();
    if (fs.existsSync(cmd) && canExecuteTerraform(cmd)) {
      return { available: true, command: cmd, source: 'env' };
    }
    return { available: false, command: cmd, note: 'TERRAFORM_BIN is set but not executable.' };
  }

  // 2) PATH
  if (canExecuteTerraform('terraform')) {
    return { available: true, command: 'terraform', source: 'path' };
  }

  // 3) WinGet portable install common locations (Windows only)
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const wingetPackagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      try {
        if (fs.existsSync(wingetPackagesDir)) {
          const entries = fs.readdirSync(wingetPackagesDir, { withFileTypes: true });
          const terraformDirs = entries
            .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith('hashicorp.terraform_'))
            .map((e) => path.join(wingetPackagesDir, e.name));

          // Prefer the newest-looking directory by mtime (good enough heuristic)
          terraformDirs.sort((a, b) => {
            try {
              return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
            } catch {
              return 0;
            }
          });

          for (const dir of terraformDirs) {
            const exe = path.join(dir, 'terraform.exe');
            if (fs.existsSync(exe) && canExecuteTerraform(exe)) {
              return {
                available: true,
                command: exe,
                source: 'winget',
                note: 'Using WinGet-installed terraform.exe (not found on PATH).'
              };
            }
          }
        }
      } catch {
        // ignore resolution errors
      }
    }
  }

  return { available: false, note: 'Terraform not found (not on PATH and no auto-discovery match).' };
}

function ensureTerraform(): TerraformResolution {
  if (TERRAFORM_RESOLUTION?.available) {
    return TERRAFORM_RESOLUTION;
  }
  TERRAFORM_RESOLUTION = tryResolveTerraform();
  return TERRAFORM_RESOLUTION;
}

// Eager log at startup, but still allow runtime resolution later (e.g. user installs terraform while server is running)
const startupResolution = ensureTerraform();
if (startupResolution.available) {
  console.log(`✓ Terraform detected (${startupResolution.source})`);
  if (startupResolution.note) console.log(`  ${startupResolution.note}`);
} else {
  console.error('✗ Terraform not found in PATH. Deployments will fail.');
  console.error('  Install Terraform: https://developer.hashicorp.com/terraform/install');
  console.error('  Or set TERRAFORM_BIN to the full path of terraform.exe');
}

export function isTerraformAvailable(): boolean {
  return ensureTerraform().available;
}

// Ensure workspaces directory exists
if (!fs.existsSync(WORKSPACES_DIR)) {
  fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
}

export class TerraformService {
  private workspaceDir: string;
  private logs: string[] = [];
  private onLog?: LogCallback;

  constructor(workspaceName: string, onLog?: LogCallback) {
    this.workspaceDir = path.join(WORKSPACES_DIR, workspaceName);
    this.onLog = onLog;
    
    // Create workspace directory if it doesn't exist
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }
  }

  private log(level: string, message: string, source: string = 'terraform') {
    const logEntry = { level, message, source };
    this.logs.push(`[${level.toUpperCase()}] ${message}`);
    if (this.onLog) {
      this.onLog(logEntry);
    }
  }

  private async runCommand(command: string, args: string[], env?: Record<string, string>): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd: this.workspaceDir,
        env: { 
          ...process.env, 
          ...env,
          // Disable output buffering for terraform
          TF_LOG_CORE: '',
          TF_LOG_PROVIDER: '',
          PYTHONUNBUFFERED: '1',
        },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let lastLogTime = Date.now();

      // Heartbeat timer to show progress during long operations
      const heartbeatInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - lastLogTime) / 1000);
        if (elapsed >= 10) {
          this.log('info', `⏳ Operation in progress... (${elapsed}s since last update)`, 'system');
        }
      }, 5000);

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        lastLogTime = Date.now();
        // Parse terraform output for logging
        text.split('\n').filter(Boolean).forEach((line: string) => {
          if (line.includes('Error')) {
            this.log('error', line, 'terraform');
          } else if (line.includes('Warning')) {
            this.log('warn', line, 'terraform');
          } else {
            this.log('info', line, 'terraform');
          }
        });
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        lastLogTime = Date.now();
        text.split('\n').filter(Boolean).forEach((line: string) => {
          this.log('error', line, 'terraform');
        });
      });

      proc.on('close', (code) => {
        clearInterval(heartbeatInterval);
        resolve({ code: code || 0, stdout, stderr });
      });

      proc.on('error', (err) => {
        clearInterval(heartbeatInterval);
        this.log('error', `Process error: ${err.message}`, 'system');
        resolve({ code: 1, stdout, stderr: err.message });
      });
    });
  }

  async init(modulePath: string): Promise<boolean> {
    const resolution = ensureTerraform();
    if (!resolution.available) {
      this.log('error', resolution.note || 'Terraform is not installed', 'system');
      return false;
    }

    this.log('info', 'Initializing Terraform workspace...', 'system');
    
    // Copy module files to workspace
    const modulesDir = resolveTerraformModulesDir();
    if (!modulesDir) {
      this.log('error', 'Terraform modules directory not found. Set TERRAFORM_MODULES_DIR or ensure server/src/terraform/modules exists in the deployment.', 'system');
      return false;
    }

    const moduleDir = path.join(modulesDir, modulePath);
    if (!fs.existsSync(moduleDir)) {
      this.log('error', `Module not found: ${modulePath}`, 'system');
      this.log('error', `Looked in: ${moduleDir}`, 'system');
      return false;
    }

    // Copy all .tf files
    const files = fs.readdirSync(moduleDir);
    for (const file of files) {
      if (file.endsWith('.tf')) {
        fs.copyFileSync(
          path.join(moduleDir, file),
          path.join(this.workspaceDir, file)
        );
      }
    }

    const result = await this.runCommand(resolution.command, ['init', '-no-color']);
    return result.code === 0;
  }

  async plan(vars: TerraformVars): Promise<{ success: boolean; planFile?: string }> {
    const resolution = ensureTerraform();
    if (!resolution.available) {
      this.log('error', resolution.note || 'Terraform is not installed', 'system');
      return { success: false };
    }

    this.log('info', 'Creating Terraform plan...', 'system');
    
    // Write variables to file
    const varsFile = path.join(this.workspaceDir, 'terraform.tfvars.json');
    fs.writeFileSync(varsFile, JSON.stringify(vars, null, 2));

    const planFile = path.join(this.workspaceDir, 'tfplan');
    const result = await this.runCommand(resolution.command, [
      'plan',
      '-no-color',
      '-input=false',
      `-var-file=${varsFile}`,
      `-out=${planFile}`
    ]);

    if (result.code === 0) {
      return { success: true, planFile };
    }
    return { success: false };
  }

  async apply(planFile?: string): Promise<TerraformResult> {
    const resolution = ensureTerraform();
    if (!resolution.available) {
      this.log('error', resolution.note || 'Terraform is not installed', 'system');
      return { success: false, error: resolution.note || 'Terraform is not installed', logs: this.logs };
    }

    this.log('info', 'Applying Terraform changes...', 'system');
    this.log('info', '⏳ This may take 30-90 seconds for cloud resources to provision...', 'system');
    
    const args = ['apply', '-no-color', '-auto-approve'];
    if (planFile) {
      args.push(planFile);
    } else {
      // Apply with vars file
      const varsFile = path.join(this.workspaceDir, 'terraform.tfvars.json');
      if (fs.existsSync(varsFile)) {
        args.push(`-var-file=${varsFile}`);
      }
    }

    const result = await this.runCommand(resolution.command, args);

    if (result.code === 0) {
      // Get outputs
      const outputs = await this.getOutputs();
      return { success: true, outputs, logs: this.logs };
    }

    return { success: false, error: result.stderr || 'Apply failed', logs: this.logs };
  }

  async destroy(): Promise<TerraformResult> {
    const resolution = ensureTerraform();
    if (!resolution.available) {
      this.log('error', resolution.note || 'Terraform is not installed', 'system');
      return { success: false, error: resolution.note || 'Terraform is not installed', logs: this.logs };
    }

    this.log('info', 'Destroying Terraform resources...', 'system');
    
    const varsFile = path.join(this.workspaceDir, 'terraform.tfvars.json');
    const args = ['destroy', '-no-color', '-auto-approve'];
    if (fs.existsSync(varsFile)) {
      args.push(`-var-file=${varsFile}`);
    }

    const result = await this.runCommand(resolution.command, args);

    if (result.code === 0) {
      return { success: true, logs: this.logs };
    }

    return { success: false, error: result.stderr || 'Destroy failed', logs: this.logs };
  }

  async getOutputs(): Promise<Record<string, any>> {
    const resolution = ensureTerraform();
    if (!resolution.available) {
      return {};
    }
    const result = await this.runCommand(resolution.command, ['output', '-json', '-no-color']);
    
    if (result.code === 0 && result.stdout) {
      try {
        const outputs = JSON.parse(result.stdout);
        // Extract values from terraform output format
        const simplified: Record<string, any> = {};
        for (const [key, val] of Object.entries(outputs)) {
          simplified[key] = (val as any).value;
        }
        return simplified;
      } catch {
        return {};
      }
    }
    return {};
  }

  async refresh(): Promise<boolean> {
    const resolution = ensureTerraform();
    if (!resolution.available) return false;

    this.log('info', 'Refreshing Terraform state...', 'system');
    
    const varsFile = path.join(this.workspaceDir, 'terraform.tfvars.json');
    const args = ['refresh', '-no-color'];
    if (fs.existsSync(varsFile)) {
      args.push(`-var-file=${varsFile}`);
    }

    const result = await this.runCommand(resolution.command, args);
    return result.code === 0;
  }

  getLogs(): string[] {
    return this.logs;
  }

  // Clean up workspace
  cleanup(): void {
    if (fs.existsSync(this.workspaceDir)) {
      fs.rmSync(this.workspaceDir, { recursive: true, force: true });
    }
  }
}

// Re-export credential functions from database (encrypted storage)
import { database } from './database';

export function storeCredentials(accountId: string, credentials: Record<string, string>): void {
  database.storeCredentials(accountId, credentials);
}

export function getCredentials(accountId: string): Record<string, string> | undefined {
  return database.getCredentials(accountId);
}

export function deleteCredentials(accountId: string): void {
  database.deleteCredentials(accountId);
}
