import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  Machine,
  Deployment,
  ProviderAccount,
  BootstrapProfile,
  FirewallProfile,
  AuditEvent,
  SSHKey
} from '@machine/shared';

// Database file location
const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'machine.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Encryption key for credentials - persisted to file so it survives restarts
const KEY_FILE = path.join(DATA_DIR, '.encryption_key');
function getOrCreateEncryptionKey(): string {
  // Use env var if set
  if (process.env.ENCRYPTION_KEY) {
    return process.env.ENCRYPTION_KEY;
  }
  // Otherwise use/create persistent key file
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  }
  const newKey = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(KEY_FILE, newKey, { mode: 0o600 });
  console.log('🔐 Generated new encryption key');
  return newKey;
}
const ENCRYPTION_KEY = getOrCreateEncryptionKey();
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- Machines table
  CREATE TABLE IF NOT EXISTS machines (
    machine_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    region TEXT NOT NULL,
    zone TEXT,
    size TEXT NOT NULL,
    image TEXT NOT NULL,
    desired_status TEXT NOT NULL,
    actual_status TEXT NOT NULL,
    public_ip TEXT,
    private_ip TEXT,
    provider_resource_id TEXT,
    vpc_id TEXT,
    subnet_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '{}',
    terraform_workspace TEXT,
    terraform_state_status TEXT,
    provisioning_method TEXT,
    bootstrap_profile_id TEXT,
    firewall_profile_id TEXT,
    agent_status TEXT DEFAULT 'not_installed'
  );

  -- Deployments table
  CREATE TABLE IF NOT EXISTS deployments (
    deployment_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    type TEXT NOT NULL,
    state TEXT NOT NULL,
    terraform_workspace TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    initiated_by TEXT,
    plan_summary TEXT,
    outputs TEXT,
    error_message TEXT,
    logs TEXT,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
  );

  -- Provider accounts table
  CREATE TABLE IF NOT EXISTS provider_accounts (
    provider_account_id TEXT PRIMARY KEY,
    provider_type TEXT NOT NULL,
    label TEXT NOT NULL,
    credential_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    last_verified_at TEXT
  );

  -- Credentials table (encrypted)
  CREATE TABLE IF NOT EXISTS credentials (
    provider_account_id TEXT PRIMARY KEY,
    encrypted_data TEXT NOT NULL,
    FOREIGN KEY (provider_account_id) REFERENCES provider_accounts(provider_account_id)
  );

  -- Bootstrap profiles table
  CREATE TABLE IF NOT EXISTS bootstrap_profiles (
    profile_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    method TEXT NOT NULL,
    cloud_init_template TEXT,
    ssh_bootstrap_script TEXT,
    ansible_playbook_ref TEXT,
    services_to_run TEXT NOT NULL DEFAULT '[]',
    config_schema TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    tags TEXT,
    is_system_profile INTEGER DEFAULT 0
  );

  -- Firewall profiles table
  CREATE TABLE IF NOT EXISTS firewall_profiles (
    profile_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rules TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Audit events table
  CREATE TABLE IF NOT EXISTS audit_events (
    event_id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    actor_id TEXT,
    actor_type TEXT,
    actor_name TEXT,
    target_type TEXT,
    target_id TEXT,
    target_name TEXT,
    timestamp TEXT NOT NULL,
    details TEXT
  );

  -- Agent metrics table
  CREATE TABLE IF NOT EXISTS agent_metrics (
    machine_id TEXT PRIMARY KEY,
    agent_version TEXT,
    hostname TEXT,
    uptime_seconds INTEGER,
    load_average TEXT,
    memory_total_mb INTEGER,
    memory_used_mb INTEGER,
    disk_total_gb INTEGER,
    disk_used_gb INTEGER,
    last_heartbeat TEXT,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
  );

  -- SSH keys table
  CREATE TABLE IF NOT EXISTS ssh_keys (
    ssh_key_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fingerprint TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    key_type TEXT NOT NULL,
    key_bits INTEGER NOT NULL,
    comment TEXT,
    provider_key_ids TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- SSH key private keys (encrypted separately)
  CREATE TABLE IF NOT EXISTS ssh_key_secrets (
    ssh_key_id TEXT PRIMARY KEY,
    encrypted_private_key TEXT NOT NULL,
    FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(ssh_key_id)
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(actual_status);
  CREATE INDEX IF NOT EXISTS idx_machines_provider ON machines(provider);
  CREATE INDEX IF NOT EXISTS idx_deployments_machine ON deployments(machine_id);
  CREATE INDEX IF NOT EXISTS idx_deployments_state ON deployments(state);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_ssh_keys_fingerprint ON ssh_keys(fingerprint);
`);

// Add last_health_check column if it doesn't exist
try {
  db.exec('ALTER TABLE machines ADD COLUMN last_health_check TEXT');
} catch (e) {
  // Column already exists, ignore
}

// Add firewall_profile_id column if it doesn't exist
try {
  db.exec('ALTER TABLE machines ADD COLUMN firewall_profile_id TEXT');
} catch (e) {
  // Column already exists, ignore
}

// Create SSH tables if they don't exist (for existing databases)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ssh_keys (
      ssh_key_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      key_type TEXT NOT NULL,
      key_bits INTEGER NOT NULL,
      comment TEXT,
      provider_key_ids TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ssh_key_secrets (
      ssh_key_id TEXT PRIMARY KEY,
      encrypted_private_key TEXT NOT NULL,
      FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(ssh_key_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ssh_keys_fingerprint ON ssh_keys(fingerprint);
  `);
} catch (e) {
  // Tables already exist, ignore
}

// Prepared statements for better performance
const statements = {
  // Machines
  getMachines: db.prepare('SELECT * FROM machines ORDER BY created_at DESC'),
  getMachine: db.prepare('SELECT * FROM machines WHERE machine_id = ?'),
  insertMachine: db.prepare(`
    INSERT INTO machines (machine_id, name, provider, provider_account_id, region, zone, size, image,
      desired_status, actual_status, public_ip, private_ip, provider_resource_id, vpc_id, subnet_id,
      created_at, updated_at, tags, terraform_workspace, terraform_state_status, provisioning_method,
      bootstrap_profile_id, firewall_profile_id, agent_status)
    VALUES (@machine_id, @name, @provider, @provider_account_id, @region, @zone, @size, @image,
      @desired_status, @actual_status, @public_ip, @private_ip, @provider_resource_id, @vpc_id, @subnet_id,
      @created_at, @updated_at, @tags, @terraform_workspace, @terraform_state_status, @provisioning_method,
      @bootstrap_profile_id, @firewall_profile_id, @agent_status)
  `),
  updateMachine: db.prepare(`
    UPDATE machines SET
      name = @name, desired_status = @desired_status, actual_status = @actual_status,
      public_ip = @public_ip, private_ip = @private_ip, provider_resource_id = @provider_resource_id,
      updated_at = @updated_at, tags = @tags, terraform_state_status = @terraform_state_status,
      agent_status = @agent_status, last_health_check = @last_health_check
    WHERE machine_id = @machine_id
  `),
  deleteMachine: db.prepare('DELETE FROM machines WHERE machine_id = ?'),

  // Agent metrics
  getAgentMetrics: db.prepare('SELECT * FROM agent_metrics WHERE machine_id = ?'),
  upsertAgentMetrics: db.prepare(`
    INSERT INTO agent_metrics (machine_id, agent_version, hostname, uptime_seconds, load_average,
      memory_total_mb, memory_used_mb, disk_total_gb, disk_used_gb, last_heartbeat)
    VALUES (@machine_id, @agent_version, @hostname, @uptime_seconds, @load_average,
      @memory_total_mb, @memory_used_mb, @disk_total_gb, @disk_used_gb, @last_heartbeat)
    ON CONFLICT(machine_id) DO UPDATE SET
      agent_version = @agent_version, hostname = @hostname, uptime_seconds = @uptime_seconds,
      load_average = @load_average, memory_total_mb = @memory_total_mb, memory_used_mb = @memory_used_mb,
      disk_total_gb = @disk_total_gb, disk_used_gb = @disk_used_gb, last_heartbeat = @last_heartbeat
  `),

  // Deployments
  getDeployments: db.prepare('SELECT * FROM deployments ORDER BY created_at DESC'),
  getDeploymentsByMachine: db.prepare('SELECT * FROM deployments WHERE machine_id = ? ORDER BY created_at DESC'),
  getDeployment: db.prepare('SELECT * FROM deployments WHERE deployment_id = ?'),
  insertDeployment: db.prepare(`
    INSERT INTO deployments (deployment_id, machine_id, type, state, terraform_workspace, created_at,
      started_at, finished_at, initiated_by, plan_summary, outputs, error_message, logs)
    VALUES (@deployment_id, @machine_id, @type, @state, @terraform_workspace, @created_at,
      @started_at, @finished_at, @initiated_by, @plan_summary, @outputs, @error_message, @logs)
  `),
  updateDeployment: db.prepare(`
    UPDATE deployments SET
      state = @state, finished_at = @finished_at, plan_summary = @plan_summary,
      outputs = @outputs, error_message = @error_message, logs = @logs
    WHERE deployment_id = @deployment_id
  `),

  // Provider accounts
  getProviderAccounts: db.prepare('SELECT * FROM provider_accounts ORDER BY created_at DESC'),
  getProviderAccount: db.prepare('SELECT * FROM provider_accounts WHERE provider_account_id = ?'),
  insertProviderAccount: db.prepare(`
    INSERT INTO provider_accounts (provider_account_id, provider_type, label, credential_status, created_at, updated_at, last_verified_at)
    VALUES (@provider_account_id, @provider_type, @label, @credential_status, @created_at, @updated_at, @last_verified_at)
  `),
  updateProviderAccount: db.prepare(`
    UPDATE provider_accounts SET
      label = @label, credential_status = @credential_status, updated_at = @updated_at, last_verified_at = @last_verified_at
    WHERE provider_account_id = @provider_account_id
  `),
  deleteProviderAccount: db.prepare('DELETE FROM provider_accounts WHERE provider_account_id = ?'),

  // Credentials
  getCredentials: db.prepare('SELECT encrypted_data FROM credentials WHERE provider_account_id = ?'),
  insertCredentials: db.prepare('INSERT OR REPLACE INTO credentials (provider_account_id, encrypted_data) VALUES (?, ?)'),
  deleteCredentials: db.prepare('DELETE FROM credentials WHERE provider_account_id = ?'),

  // Bootstrap profiles
  getBootstrapProfiles: db.prepare('SELECT * FROM bootstrap_profiles ORDER BY is_system_profile DESC, created_at ASC'),
  getBootstrapProfile: db.prepare('SELECT * FROM bootstrap_profiles WHERE profile_id = ?'),
  insertBootstrapProfile: db.prepare(`
    INSERT INTO bootstrap_profiles (profile_id, name, description, method, cloud_init_template,
      ssh_bootstrap_script, ansible_playbook_ref, services_to_run, config_schema, created_at,
      updated_at, created_by, tags, is_system_profile)
    VALUES (@profile_id, @name, @description, @method, @cloud_init_template,
      @ssh_bootstrap_script, @ansible_playbook_ref, @services_to_run, @config_schema, @created_at,
      @updated_at, @created_by, @tags, @is_system_profile)
  `),
  updateBootstrapProfile: db.prepare(`
    UPDATE bootstrap_profiles SET
      name = @name, description = @description, cloud_init_template = @cloud_init_template,
      ssh_bootstrap_script = @ssh_bootstrap_script, ansible_playbook_ref = @ansible_playbook_ref,
      services_to_run = @services_to_run, config_schema = @config_schema, updated_at = @updated_at, tags = @tags
    WHERE profile_id = @profile_id
  `),
  deleteBootstrapProfile: db.prepare('DELETE FROM bootstrap_profiles WHERE profile_id = ?'),

  // Firewall profiles
  getFirewallProfiles: db.prepare('SELECT * FROM firewall_profiles ORDER BY created_at ASC'),
  getFirewallProfile: db.prepare('SELECT * FROM firewall_profiles WHERE profile_id = ?'),
  insertFirewallProfile: db.prepare(`
    INSERT INTO firewall_profiles (profile_id, name, description, rules, created_at, updated_at)
    VALUES (@profile_id, @name, @description, @rules, @created_at, @updated_at)
  `),

  // Audit events
  getAuditEvents: db.prepare('SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 1000'),
  insertAuditEvent: db.prepare(`
    INSERT INTO audit_events (event_id, action, outcome, actor_id, actor_type, actor_name,
      target_type, target_id, target_name, timestamp, details)
    VALUES (@event_id, @action, @outcome, @actor_id, @actor_type, @actor_name,
      @target_type, @target_id, @target_name, @timestamp, @details)
  `),

  // SSH Keys
  getSSHKeys: db.prepare('SELECT * FROM ssh_keys ORDER BY created_at DESC'),
  getSSHKey: db.prepare('SELECT * FROM ssh_keys WHERE ssh_key_id = ?'),
  getSSHKeyByFingerprint: db.prepare('SELECT * FROM ssh_keys WHERE fingerprint = ?'),
  insertSSHKey: db.prepare(`
    INSERT INTO ssh_keys (ssh_key_id, name, fingerprint, public_key, key_type, key_bits, comment, provider_key_ids, created_at, updated_at)
    VALUES (@ssh_key_id, @name, @fingerprint, @public_key, @key_type, @key_bits, @comment, @provider_key_ids, @created_at, @updated_at)
  `),
  updateSSHKey: db.prepare(`
    UPDATE ssh_keys SET
      name = @name, provider_key_ids = @provider_key_ids, updated_at = @updated_at
    WHERE ssh_key_id = @ssh_key_id
  `),
  deleteSSHKey: db.prepare('DELETE FROM ssh_keys WHERE ssh_key_id = ?'),

  // SSH Key Secrets (encrypted private keys)
  getSSHKeySecret: db.prepare('SELECT encrypted_private_key FROM ssh_key_secrets WHERE ssh_key_id = ?'),
  insertSSHKeySecret: db.prepare('INSERT OR REPLACE INTO ssh_key_secrets (ssh_key_id, encrypted_private_key) VALUES (?, ?)'),
  deleteSSHKeySecret: db.prepare('DELETE FROM ssh_key_secrets WHERE ssh_key_id = ?'),
};

// Helper to parse JSON fields from DB rows
function parseMachine(row: any): Machine {
  return {
    ...row,
    tags: JSON.parse(row.tags || '{}'),
  };
}

function parseDeployment(row: any): Deployment {
  let logs: any = row.logs ? JSON.parse(row.logs) : undefined;
  // Historical bug: logs were sometimes double-JSON-encoded, so JSON.parse(row.logs)
  // produced a string that itself contains JSON. Try to unwrap once more.
  if (typeof logs === 'string') {
    try {
      logs = JSON.parse(logs);
    } catch {
      // ignore
    }
  }
  return {
    ...row,
    plan_summary: row.plan_summary ? JSON.parse(row.plan_summary) : undefined,
    outputs: row.outputs ? JSON.parse(row.outputs) : undefined,
    logs,
  };
}

function serializeJsonField(value: any): string | null {
  if (value === undefined || value === null) return null;
  // If callers provide a JSON string, assume it's already serialized.
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseBootstrapProfile(row: any): BootstrapProfile {
  return {
    ...row,
    services_to_run: JSON.parse(row.services_to_run || '[]'),
    config_schema: row.config_schema ? JSON.parse(row.config_schema) : undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    is_system_profile: Boolean(row.is_system_profile),
  };
}

function parseFirewallProfile(row: any): FirewallProfile {
  return {
    ...row,
    rules: JSON.parse(row.rules || '[]'),
  };
}

function parseAuditEvent(row: any): AuditEvent {
  return {
    ...row,
    details: row.details ? JSON.parse(row.details) : undefined,
  };
}

function parseSSHKey(row: any): SSHKey {
  return {
    ...row,
    provider_key_ids: JSON.parse(row.provider_key_ids || '{}'),
  };
}

// Database operations
export const database = {
  // Machines
  getMachines(): Machine[] {
    return statements.getMachines.all().map(parseMachine);
  },
  getMachine(id: string): Machine | undefined {
    const row = statements.getMachine.get(id);
    return row ? parseMachine(row) : undefined;
  },
  insertMachine(machine: Machine): void {
    statements.insertMachine.run({
      ...machine,
      public_ip: machine.public_ip || null,
      private_ip: machine.private_ip || null,
      provider_resource_id: machine.provider_resource_id || null,
      vpc_id: machine.vpc_id || null,
      subnet_id: machine.subnet_id || null,
      firewall_profile_id: machine.firewall_profile_id || null,
      tags: JSON.stringify(machine.tags || {}),
    });
  },
  updateMachine(machine: Partial<Machine> & { machine_id: string }): void {
    const existing = this.getMachine(machine.machine_id);
    if (!existing) return;
    statements.updateMachine.run({
      ...existing,
      ...machine,
      tags: JSON.stringify(machine.tags || existing.tags || {}),
      last_health_check: machine.last_health_check || (existing as any).last_health_check || null,
    });
  },
  deleteMachine(id: string): void {
    statements.deleteMachine.run(id);
  },

  // Agent metrics
  getAgentMetrics(machineId: string): any {
    const row = statements.getAgentMetrics.get(machineId) as any;
    if (!row) return null;
    return {
      ...row,
      load_average: row.load_average ? JSON.parse(row.load_average) : null,
    };
  },
  updateAgentMetrics(machineId: string, metrics: {
    agent_version: string;
    hostname: string;
    uptime_seconds: number;
    load_average: [number, number, number];
    memory_total_mb: number;
    memory_used_mb: number;
    disk_total_gb: number;
    disk_used_gb: number;
    last_heartbeat: string;
  }): void {
    statements.upsertAgentMetrics.run({
      machine_id: machineId,
      ...metrics,
      load_average: JSON.stringify(metrics.load_average),
    });
  },

  // Deployments
  getDeployments(): Deployment[] {
    return statements.getDeployments.all().map(parseDeployment);
  },
  getDeploymentsByMachine(machineId: string): Deployment[] {
    return statements.getDeploymentsByMachine.all(machineId).map(parseDeployment);
  },
  getDeployment(id: string): Deployment | undefined {
    const row = statements.getDeployment.get(id);
    return row ? parseDeployment(row) : undefined;
  },
  insertDeployment(deployment: Deployment): void {
    statements.insertDeployment.run({
      ...deployment,
      started_at: deployment.started_at || null,
      finished_at: deployment.finished_at || null,
      initiated_by: deployment.initiated_by || null,
      plan_summary: deployment.plan_summary ? JSON.stringify(deployment.plan_summary) : null,
      outputs: deployment.outputs ? JSON.stringify(deployment.outputs) : null,
      error_message: deployment.error_message || null,
      logs: null,
    });
  },
  updateDeployment(deployment: Partial<Deployment> & { deployment_id: string }): void {
    const existing = this.getDeployment(deployment.deployment_id);
    if (!existing) return;
    statements.updateDeployment.run({
      deployment_id: deployment.deployment_id,
      state: deployment.state || existing.state,
      finished_at: deployment.finished_at || existing.finished_at || null,
      plan_summary: deployment.plan_summary ? JSON.stringify(deployment.plan_summary) : (existing.plan_summary ? JSON.stringify(existing.plan_summary) : null),
      outputs: deployment.outputs ? JSON.stringify(deployment.outputs) : (existing.outputs ? JSON.stringify(existing.outputs) : null),
      error_message: deployment.error_message || existing.error_message || null,
      // Preserve existing logs unless explicitly provided.
      logs: (deployment as any).logs !== undefined
        ? serializeJsonField((deployment as any).logs)
        : serializeJsonField((existing as any).logs),
    });
  },

  // Provider accounts
  getProviderAccounts(): ProviderAccount[] {
    return statements.getProviderAccounts.all() as ProviderAccount[];
  },
  getProviderAccount(id: string): ProviderAccount | undefined {
    return statements.getProviderAccount.get(id) as ProviderAccount | undefined;
  },
  insertProviderAccount(account: ProviderAccount): void {
    statements.insertProviderAccount.run(account);
  },
  updateProviderAccount(account: Partial<ProviderAccount> & { provider_account_id: string }): void {
    const existing = this.getProviderAccount(account.provider_account_id);
    if (!existing) return;
    statements.updateProviderAccount.run({
      ...existing,
      ...account,
    });
  },
  deleteProviderAccount(id: string): void {
    statements.deleteProviderAccount.run(id);
    statements.deleteCredentials.run(id);
  },

  // Credentials (encrypted)
  getCredentials(accountId: string): Record<string, string> | undefined {
    const row = statements.getCredentials.get(accountId) as { encrypted_data: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(decrypt(row.encrypted_data));
    } catch (error) {
      console.error(`Failed to decrypt credentials for ${accountId}:`, error);
      // Delete corrupted credentials
      statements.deleteCredentials.run(accountId);
      return undefined;
    }
  },
  storeCredentials(accountId: string, credentials: Record<string, string>): void {
    const encrypted = encrypt(JSON.stringify(credentials));
    statements.insertCredentials.run(accountId, encrypted);
  },
  deleteCredentials(accountId: string): void {
    statements.deleteCredentials.run(accountId);
  },

  // Bootstrap profiles
  getBootstrapProfiles(): BootstrapProfile[] {
    return statements.getBootstrapProfiles.all().map(parseBootstrapProfile);
  },
  getBootstrapProfile(id: string): BootstrapProfile | undefined {
    const row = statements.getBootstrapProfile.get(id);
    return row ? parseBootstrapProfile(row) : undefined;
  },
  insertBootstrapProfile(profile: BootstrapProfile): void {
    statements.insertBootstrapProfile.run({
      profile_id: profile.profile_id,
      name: profile.name,
      description: profile.description || null,
      method: profile.method,
      cloud_init_template: profile.cloud_init_template || null,
      ssh_bootstrap_script: profile.ssh_bootstrap_script || null,
      ansible_playbook_ref: profile.ansible_playbook_ref || null,
      services_to_run: JSON.stringify(profile.services_to_run || []),
      config_schema: profile.config_schema ? JSON.stringify(profile.config_schema) : null,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      created_by: profile.created_by || null,
      tags: profile.tags ? JSON.stringify(profile.tags) : null,
      is_system_profile: profile.is_system_profile ? 1 : 0,
    });
  },
  updateBootstrapProfile(profile: Partial<BootstrapProfile> & { profile_id: string }): void {
    const existing = this.getBootstrapProfile(profile.profile_id);
    if (!existing) return;
    statements.updateBootstrapProfile.run({
      ...existing,
      ...profile,
      services_to_run: JSON.stringify(profile.services_to_run || existing.services_to_run || []),
      config_schema: profile.config_schema ? JSON.stringify(profile.config_schema) : (existing.config_schema ? JSON.stringify(existing.config_schema) : null),
      tags: profile.tags ? JSON.stringify(profile.tags) : (existing.tags ? JSON.stringify(existing.tags) : null),
    });
  },
  deleteBootstrapProfile(id: string): void {
    statements.deleteBootstrapProfile.run(id);
  },

  // Firewall profiles
  getFirewallProfiles(): FirewallProfile[] {
    return statements.getFirewallProfiles.all().map(parseFirewallProfile);
  },
  getFirewallProfile(id: string): FirewallProfile | undefined {
    const row = statements.getFirewallProfile.get(id);
    return row ? parseFirewallProfile(row) : undefined;
  },
  insertFirewallProfile(profile: FirewallProfile): void {
    statements.insertFirewallProfile.run({
      ...profile,
      rules: JSON.stringify(profile.rules || []),
    });
  },

  // Audit events
  getAuditEvents(): AuditEvent[] {
    return statements.getAuditEvents.all().map(parseAuditEvent);
  },
  insertAuditEvent(event: AuditEvent): void {
    statements.insertAuditEvent.run({
      ...event,
      details: event.details ? JSON.stringify(event.details) : null,
    });
  },

  // SSH Keys
  getSSHKeys(): SSHKey[] {
    return statements.getSSHKeys.all().map(parseSSHKey);
  },
  getSSHKey(id: string): SSHKey | undefined {
    const row = statements.getSSHKey.get(id);
    return row ? parseSSHKey(row) : undefined;
  },
  getSSHKeyByFingerprint(fingerprint: string): SSHKey | undefined {
    const row = statements.getSSHKeyByFingerprint.get(fingerprint);
    return row ? parseSSHKey(row) : undefined;
  },
  insertSSHKey(key: SSHKey): void {
    statements.insertSSHKey.run({
      ...key,
      comment: key.comment || null,
      provider_key_ids: JSON.stringify(key.provider_key_ids || {}),
    });
  },
  updateSSHKey(key: Partial<SSHKey> & { ssh_key_id: string }): void {
    const existing = this.getSSHKey(key.ssh_key_id);
    if (!existing) return;
    statements.updateSSHKey.run({
      ssh_key_id: key.ssh_key_id,
      name: key.name || existing.name,
      provider_key_ids: JSON.stringify(key.provider_key_ids || existing.provider_key_ids || {}),
      updated_at: new Date().toISOString(),
    });
  },
  deleteSSHKey(id: string): void {
    statements.deleteSSHKeySecret.run(id);
    statements.deleteSSHKey.run(id);
  },

  // SSH Key Secrets (encrypted private keys)
  getSSHKeyPrivateKey(keyId: string): string | undefined {
    const row = statements.getSSHKeySecret.get(keyId) as { encrypted_private_key: string } | undefined;
    if (!row) return undefined;
    try {
      return decrypt(row.encrypted_private_key);
    } catch (error) {
      console.error(`Failed to decrypt private key for ${keyId}:`, error);
      return undefined;
    }
  },
  storeSSHKeyPrivateKey(keyId: string, privateKey: string): void {
    const encrypted = encrypt(privateKey);
    statements.insertSSHKeySecret.run(keyId, encrypted);
  },
  deleteSSHKeyPrivateKey(keyId: string): void {
    statements.deleteSSHKeySecret.run(keyId);
  },

  // Close database
  close(): void {
    db.close();
  },
};

// Seed default data if empty
function seedDefaults() {
  // Check if Grid profile exists - always update system profiles to latest
  const gridProfile = database.getBootstrapProfile('bp_the_grid');
  if (gridProfile) {
    console.log('📦 Updating default bootstrap profile: The Grid');
    // Delete and re-insert to update
    db.prepare('DELETE FROM bootstrap_profiles WHERE profile_id = ?').run('bp_the_grid');
  } else {
    console.log('📦 Seeding default bootstrap profile: The Grid');
  }
  database.insertBootstrapProfile({
      profile_id: 'bp_the_grid',
      name: 'The Grid',
      description: 'Cypher AGI Grid node - installs Rust via rustup and builds the-grid from GitHub',
      method: 'cloud_init',
      cloud_init_template: `#cloud-config
package_update: true
package_upgrade: true

packages:
  - build-essential
  - pkg-config
  - libssl-dev
  - libclang-dev
  - git
  - curl

users:
  - name: grid
    groups: sudo
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    home: /home/grid

write_files:
  - path: /etc/systemd/system/the-grid.service
    content: |
      [Unit]
      Description=The Grid Node
      After=network.target
      
      [Service]
      Type=simple
      User=grid
      WorkingDirectory=/home/grid/the-grid
      Environment=RUST_LOG=info
      Environment=GRID_BIND_ADDR=0.0.0.0:36900
      ExecStart=/home/grid/the-grid/target/release/the-grid
      Restart=always
      RestartSec=10
      
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'

  - path: /etc/systemd/system/machine-agent.service
    content: |
      [Unit]
      Description=Machine Agent - sends heartbeat to dashboard
      After=network-online.target
      Wants=network-online.target
      
      [Service]
      Type=simple
      ExecStart=/opt/machine-agent/agent.sh
      Restart=always
      RestartSec=30
      
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'

  - path: /opt/machine-agent/agent.sh
    content: |
      #!/bin/bash
      # Machine Agent - Simple heartbeat sender
      
      # Configuration (set by cloud-init)
      MACHINE_ID="{{MACHINE_ID}}"
      SERVER_URL="{{SERVER_URL}}"
      AGENT_VERSION="1.0.0"
      
      # Wait for network
      sleep 10
      
      while true; do
        # Get system info
        HOSTNAME=$(hostname)
        UPTIME=$(cat /proc/uptime | cut -d' ' -f1 | cut -d'.' -f1)
        LOAD=$(cat /proc/loadavg | cut -d' ' -f1-3 | tr ' ' ',')
        
        # Memory info (in MB)
        MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
        MEM_USED=$(free -m | awk '/^Mem:/{print $3}')
        
        # Disk info (in GB)
        DISK_TOTAL=$(df -BG / | awk 'NR==2{print $2}' | tr -d 'G')
        DISK_USED=$(df -BG / | awk 'NR==2{print $3}' | tr -d 'G')
        
        # Get public IP
        PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || echo "")
        
        # Build JSON payload
        PAYLOAD=$(cat <<EOF
      {
        "machine_id": "$MACHINE_ID",
        "agent_version": "$AGENT_VERSION",
        "hostname": "$HOSTNAME",
        "uptime_seconds": $UPTIME,
        "load_average": [$LOAD],
        "memory_total_mb": $MEM_TOTAL,
        "memory_used_mb": $MEM_USED,
        "disk_total_gb": $DISK_TOTAL,
        "disk_used_gb": $DISK_USED,
        "public_ip": "$PUBLIC_IP"
      }
      EOF
      )
        
        # Send heartbeat
        curl -s -X POST "$SERVER_URL/api/agent/heartbeat" \
          -H "Content-Type: application/json" \
          -d "$PAYLOAD" > /dev/null 2>&1
        
        # Sleep 30 seconds
        sleep 30
      done
    permissions: '0755'

  - path: /home/grid/setup-grid.sh
    content: |
      #!/bin/bash
      set -e
      exec > >(tee /var/log/grid-setup.log) 2>&1
      
      echo "=== $(date) - Starting Grid Setup ==="
      
      # Install Rust using rustup (downloads pre-built binaries)
      echo "=== Installing Rust via rustup ==="
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
      
      # Source cargo environment
      source "$HOME/.cargo/env"
      
      # Verify installation
      echo "=== Verifying Rust installation ==="
      rustc --version
      cargo --version
      
      # Clone the repository
      echo "=== Cloning the-grid repository ==="
      if [ -d "/home/grid/the-grid" ]; then
        echo "Directory exists, pulling latest..."
        cd /home/grid/the-grid
        git pull
      else
        git clone https://github.com/cypher-agi/the-grid.git /home/grid/the-grid
        cd /home/grid/the-grid
      fi
      
      # Build in release mode
      echo "=== Building the-grid ==="
      cargo build --release
      
      # Verify binary exists
      echo "=== Verifying build ==="
      if [ -f "target/release/the-grid" ]; then
        echo "SUCCESS: Binary built at target/release/the-grid"
        ls -la target/release/the-grid
      else
        echo "ERROR: Binary not found!"
        ls -la target/release/ || true
        exit 1
      fi
      
      echo "=== $(date) - Grid Setup Complete ==="
    permissions: '0755'

runcmd:
  # Ensure grid user owns their home directory
  - mkdir -p /home/grid
  - chown -R grid:grid /home/grid
  
  # Setup machine agent directory
  - mkdir -p /opt/machine-agent
  - chmod 755 /opt/machine-agent/agent.sh
  
  # Run setup as grid user
  - chown grid:grid /home/grid/setup-grid.sh
  - su - grid -c '/home/grid/setup-grid.sh'
  
  # Verify binary was built before starting service
  - |
    if [ -f "/home/grid/the-grid/target/release/the-grid" ]; then
      echo "Binary found, starting service..."
      systemctl daemon-reload
      systemctl enable the-grid.service
      systemctl start the-grid.service
      echo "The Grid service started successfully" | tee -a /var/log/grid-bootstrap.log
    else
      echo "ERROR: Binary not found, service not started" | tee -a /var/log/grid-bootstrap.log
      exit 1
    fi
  
  # Start machine agent
  - systemctl daemon-reload
  - systemctl enable machine-agent.service
  - systemctl start machine-agent.service
  - echo "Machine agent started" | tee -a /var/log/grid-bootstrap.log
  
  # Log completion
  - echo "The Grid bootstrap complete at $(date)" | tee -a /var/log/grid-bootstrap.log

# Reboot to apply kernel updates and ensure clean state
power_state:
  mode: reboot
  message: "Rebooting to apply kernel updates"
  timeout: 30
  condition: true`,
      services_to_run: [
        {
          service_name: 'the-grid',
          display_name: 'The Grid',
          systemd_unit: 'the-grid.service',
          restart_command: 'systemctl restart the-grid',
          ports: [36900]
        }
      ],
      config_schema: [
        { name: 'GRID_NODE_ID', type: 'string', description: 'Unique node identifier', required: false }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'system',
      tags: ['production', 'grid', 'rust'],
      is_system_profile: true
    });

  // Check if Grid firewall profile exists
  const gridFirewall = database.getFirewallProfile('fw_grid_node');
  if (!gridFirewall) {
    console.log('🔥 Seeding default firewall profile: Grid Node');
    database.insertFirewallProfile({
      profile_id: 'fw_grid_node',
      name: 'Grid Node',
      description: 'Grid node firewall with SSH and Grid port access',
      rules: [
        { rule_id: 'r1', direction: 'inbound', protocol: 'tcp', port_range_start: 22, port_range_end: 22, source_addresses: ['0.0.0.0/0'], description: 'SSH', source: 'provider' },
        { rule_id: 'r2', direction: 'inbound', protocol: 'tcp', port_range_start: 36900, port_range_end: 36900, source_addresses: ['0.0.0.0/0'], description: 'The Grid', source: 'provider' }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // Machine Dashboard bootstrap profile
  const machineProfile = database.getBootstrapProfile('bp_machine_dashboard');
  if (machineProfile) {
    console.log('📦 Updating default bootstrap profile: Machine Dashboard');
    db.prepare('DELETE FROM bootstrap_profiles WHERE profile_id = ?').run('bp_machine_dashboard');
  } else {
    console.log('📦 Seeding default bootstrap profile: Machine Dashboard');
  }
  database.insertBootstrapProfile({
    profile_id: 'bp_machine_dashboard',
    name: 'Machine Dashboard',
    description: 'Deploys the Machine infrastructure management dashboard with Node.js and Terraform',
    method: 'cloud_init',
    cloud_init_template: `#cloud-config
package_update: true
package_upgrade: true

packages:
  - curl
  - git
  - build-essential
  - unzip
  - nginx
  - python3
  - python3-pip

users:
  - name: machine
    groups: sudo
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    home: /home/machine

write_files:
  - path: /etc/systemd/system/machine-dashboard.service
    content: |
      [Unit]
      Description=Machine Dashboard API
      After=network.target
      
      [Service]
      Type=simple
      User=machine
      Group=machine
      WorkingDirectory=/home/machine/machine/server
      Environment=NODE_ENV=production
      Environment=PORT=3001
      Environment=CORS_ORIGIN=*
      ExecStart=/usr/bin/node dist/index.js
      Restart=always
      RestartSec=10
      StandardOutput=append:/var/log/machine-dashboard.log
      StandardError=append:/var/log/machine-dashboard.log
      
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'

  - path: /etc/nginx/sites-available/machine
    content: |
      server {
          listen 80;
          server_name _;
          
          # Serve frontend static files
          location / {
              root /home/machine/machine/client/dist;
              try_files $uri $uri/ /index.html;
              add_header Cache-Control "no-cache";
          }
          
          # Proxy API requests to backend
          location /api {
              proxy_pass http://127.0.0.1:3001;
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_set_header X-Real-IP $remote_addr;
              proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
              proxy_cache_bypass $http_upgrade;
              
              # SSE support for deployment logs
              proxy_buffering off;
              proxy_read_timeout 86400;
          }
          
          # WebSocket support for terminal
          location /ws/ {
              proxy_pass http://127.0.0.1:3001;
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection "upgrade";
              proxy_set_header Host $host;
              proxy_set_header X-Real-IP $remote_addr;
              proxy_read_timeout 86400;
          }
          
          # Health check
          location /health {
              proxy_pass http://127.0.0.1:3001/health;
          }
      }
    permissions: '0644'

  - path: /home/machine/setup-machine.sh
    content: |
      #!/bin/bash
      set -e
      exec > >(tee /var/log/machine-setup.log) 2>&1
      
      echo "=== $(date) - Starting Machine Dashboard Setup ==="
      
      # Install Node.js 20
      echo "=== Installing Node.js 20 ==="
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
      echo "Node version: $(node --version)"
      echo "NPM version: $(npm --version)"
      
      # Install Terraform
      echo "=== Installing Terraform ==="
      curl -fsSL https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip -o /tmp/terraform.zip
      sudo unzip -o /tmp/terraform.zip -d /usr/local/bin/
      rm /tmp/terraform.zip
      echo "Terraform version: $(terraform --version)"
      
      # Clone Machine repository
      echo "=== Cloning Machine repository ==="
      cd /home/machine
      if [ -d "machine" ]; then
        echo "Directory exists, pulling latest..."
        cd machine
        git fetch origin
        git reset --hard origin/master
      else
        git clone https://github.com/cypher-agi/machine.git machine
        cd machine
      fi
      
      echo "=== Current directory: $(pwd) ==="
      ls -la
      
      # Install dependencies
      echo "=== Installing npm dependencies ==="
      npm install
      
      # Build the shared package first
      echo "=== Building shared package ==="
      npm run build --workspace=shared
      
      # Build the server
      echo "=== Building server ==="
      npm run build --workspace=server
      
      # Build the client
      echo "=== Building client ==="
      npm run build --workspace=client
      
      # Create data directory for SQLite
      echo "=== Creating data directory ==="
      mkdir -p /home/machine/machine/server/.data
      chmod 755 /home/machine/machine/server/.data
      
      # Get public IP and update service config
      echo "=== Configuring service ==="
      PUBLIC_IP=$(curl -s --max-time 10 ifconfig.me || curl -s --max-time 10 api.ipify.org || echo "localhost")
      echo "Public IP: $PUBLIC_IP"
      
      # Create environment file for the service
      sudo tee /etc/machine-dashboard.env > /dev/null <<EOF
NODE_ENV=production
PORT=3001
PUBLIC_SERVER_URL=http://$PUBLIC_IP
CORS_ORIGIN=*
EOF
      
      echo "=== Verifying build ==="
      ls -la /home/machine/machine/server/dist/
      ls -la /home/machine/machine/client/dist/
      
      echo "=== $(date) - Machine Dashboard Setup Complete ==="
    permissions: '0755'

runcmd:
  # Create machine user home
  - mkdir -p /home/machine
  - chown -R machine:machine /home/machine
  
  # Run setup as machine user
  - chown machine:machine /home/machine/setup-machine.sh
  - chmod +x /home/machine/setup-machine.sh
  - su - machine -c '/home/machine/setup-machine.sh'
  
  # Update systemd service to use environment file
  - |
    cat > /etc/systemd/system/machine-dashboard.service <<EOF
    [Unit]
    Description=Machine Dashboard API
    After=network.target
    
    [Service]
    Type=simple
    User=machine
    Group=machine
    WorkingDirectory=/home/machine/machine/server
    EnvironmentFile=/etc/machine-dashboard.env
    ExecStart=/usr/bin/node dist/index.js
    Restart=always
    RestartSec=10
    StandardOutput=append:/var/log/machine-dashboard.log
    StandardError=append:/var/log/machine-dashboard.log
    
    [Install]
    WantedBy=multi-user.target
    EOF
  
  # Setup nginx
  - rm -f /etc/nginx/sites-enabled/default
  - ln -sf /etc/nginx/sites-available/machine /etc/nginx/sites-enabled/machine
  - nginx -t && systemctl restart nginx
  
  # Create log file with correct permissions
  - touch /var/log/machine-dashboard.log
  - chown machine:machine /var/log/machine-dashboard.log
  
  # Start the dashboard service
  - systemctl daemon-reload
  - systemctl enable machine-dashboard.service
  - systemctl start machine-dashboard.service
  
  # Wait and check status
  - sleep 5
  - systemctl status machine-dashboard.service || true
  - curl -s http://localhost:3001/health || echo "API not responding yet"
  
  # Log completion
  - echo "Machine Dashboard deployed at $(date)" | tee -a /var/log/machine-bootstrap.log
  - echo "Access at http://$(curl -s ifconfig.me)" | tee -a /var/log/machine-bootstrap.log`,
    services_to_run: [
      {
        service_name: 'machine-dashboard',
        display_name: 'Machine Dashboard',
        systemd_unit: 'machine-dashboard.service',
        restart_command: 'systemctl restart machine-dashboard',
        ports: [3001]
      },
      {
        service_name: 'nginx',
        display_name: 'Nginx',
        systemd_unit: 'nginx.service',
        restart_command: 'systemctl restart nginx',
        ports: [80]
      }
    ],
    config_schema: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'system',
    tags: ['production', 'dashboard', 'node'],
    is_system_profile: true
  });

  // Machine Dashboard firewall profile
  const machineFirewall = database.getFirewallProfile('fw_machine_dashboard');
  if (!machineFirewall) {
    console.log('🔥 Seeding default firewall profile: Machine Dashboard');
    database.insertFirewallProfile({
      profile_id: 'fw_machine_dashboard',
      name: 'Machine Dashboard',
      description: 'Machine dashboard with HTTP, HTTPS, and API access',
      rules: [
        { rule_id: 'r1', direction: 'inbound', protocol: 'tcp', port_range_start: 22, port_range_end: 22, source_addresses: ['0.0.0.0/0'], description: 'SSH', source: 'provider' },
        { rule_id: 'r2', direction: 'inbound', protocol: 'tcp', port_range_start: 80, port_range_end: 80, source_addresses: ['0.0.0.0/0'], description: 'HTTP', source: 'provider' },
        { rule_id: 'r3', direction: 'inbound', protocol: 'tcp', port_range_start: 443, port_range_end: 443, source_addresses: ['0.0.0.0/0'], description: 'HTTPS', source: 'provider' },
        { rule_id: 'r4', direction: 'inbound', protocol: 'tcp', port_range_start: 3001, port_range_end: 3001, source_addresses: ['0.0.0.0/0'], description: 'API Direct', source: 'provider' }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
}

// Run seed on import
seedDefaults();

console.log('✓ SQLite database initialized at', DB_PATH);

export default database;

