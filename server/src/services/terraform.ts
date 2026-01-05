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
const MODULES_DIR = path.join(__dirname, '../terraform/modules');

// Check if terraform is installed
let TERRAFORM_AVAILABLE = false;

try {
  execSync('terraform --version', { stdio: 'ignore' });
  TERRAFORM_AVAILABLE = true;
  console.log('✓ Terraform detected');
} catch {
  console.error('✗ Terraform not found in PATH. Deployments will fail.');
  console.error('  Install Terraform: https://developer.hashicorp.com/terraform/install');
}

export function isTerraformAvailable(): boolean {
  return TERRAFORM_AVAILABLE;
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
        env: { ...process.env, ...env },
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
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
        text.split('\n').filter(Boolean).forEach((line: string) => {
          this.log('error', line, 'terraform');
        });
      });

      proc.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });

      proc.on('error', (err) => {
        this.log('error', `Process error: ${err.message}`, 'system');
        resolve({ code: 1, stdout, stderr: err.message });
      });
    });
  }

  async init(modulePath: string): Promise<boolean> {
    if (!TERRAFORM_AVAILABLE) {
      this.log('error', 'Terraform is not installed', 'system');
      return false;
    }

    this.log('info', 'Initializing Terraform workspace...', 'system');
    
    // Copy module files to workspace
    const moduleDir = path.join(MODULES_DIR, modulePath);
    if (!fs.existsSync(moduleDir)) {
      this.log('error', `Module not found: ${modulePath}`, 'system');
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

    const result = await this.runCommand('terraform', ['init', '-no-color']);
    return result.code === 0;
  }

  async plan(vars: TerraformVars): Promise<{ success: boolean; planFile?: string }> {
    if (!TERRAFORM_AVAILABLE) {
      this.log('error', 'Terraform is not installed', 'system');
      return { success: false };
    }

    this.log('info', 'Creating Terraform plan...', 'system');
    
    // Write variables to file
    const varsFile = path.join(this.workspaceDir, 'terraform.tfvars.json');
    fs.writeFileSync(varsFile, JSON.stringify(vars, null, 2));

    const planFile = path.join(this.workspaceDir, 'tfplan');
    const result = await this.runCommand('terraform', [
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
    if (!TERRAFORM_AVAILABLE) {
      this.log('error', 'Terraform is not installed', 'system');
      return { success: false, error: 'Terraform is not installed', logs: this.logs };
    }

    this.log('info', 'Applying Terraform changes...', 'system');
    
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

    const result = await this.runCommand('terraform', args);

    if (result.code === 0) {
      // Get outputs
      const outputs = await this.getOutputs();
      return { success: true, outputs, logs: this.logs };
    }

    return { success: false, error: result.stderr || 'Apply failed', logs: this.logs };
  }

  async destroy(): Promise<TerraformResult> {
    if (!TERRAFORM_AVAILABLE) {
      this.log('error', 'Terraform is not installed', 'system');
      return { success: false, error: 'Terraform is not installed', logs: this.logs };
    }

    this.log('info', 'Destroying Terraform resources...', 'system');
    
    const varsFile = path.join(this.workspaceDir, 'terraform.tfvars.json');
    const args = ['destroy', '-no-color', '-auto-approve'];
    if (fs.existsSync(varsFile)) {
      args.push(`-var-file=${varsFile}`);
    }

    const result = await this.runCommand('terraform', args);

    if (result.code === 0) {
      return { success: true, logs: this.logs };
    }

    return { success: false, error: result.stderr || 'Destroy failed', logs: this.logs };
  }

  async getOutputs(): Promise<Record<string, any>> {
    const result = await this.runCommand('terraform', ['output', '-json', '-no-color']);
    
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
    if (!TERRAFORM_AVAILABLE) {
      return false;
    }

    this.log('info', 'Refreshing Terraform state...', 'system');
    
    const varsFile = path.join(this.workspaceDir, 'terraform.tfvars.json');
    const args = ['refresh', '-no-color'];
    if (fs.existsSync(varsFile)) {
      args.push(`-var-file=${varsFile}`);
    }

    const result = await this.runCommand('terraform', args);
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
