import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import type {
  Machine,
  Deployment,
  ProviderAccount,
  BootstrapProfile,
  FirewallProfile,
  AuditEvent,
  SSHKey,
  DeploymentLog,
  User,
  Session,
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembership,
  TeamMemberWithUser,
} from '@machina/shared';

// Raw database row types (before JSON parsing)
interface MachineRow extends Omit<Machine, 'tags' | 'last_health_check'> {
  team_id: string;
  tags: string;
  last_health_check?: string | null;
}

interface DeploymentRow extends Omit<Deployment, 'plan_summary' | 'outputs' | 'logs'> {
  team_id: string;
  plan_summary: string | null;
  outputs: string | null;
  logs: string | null;
}

interface BootstrapProfileRow extends Omit<
  BootstrapProfile,
  'services_to_run' | 'config_schema' | 'tags' | 'is_system_profile' | 'team_id'
> {
  team_id: string | null;
  services_to_run: string;
  config_schema: string | null;
  tags: string | null;
  is_system_profile: number;
}

interface FirewallProfileRow extends Omit<FirewallProfile, 'rules'> {
  rules: string;
}

interface AuditEventRow extends Omit<AuditEvent, 'details'> {
  details: string | null;
}

interface SSHKeyRow extends Omit<SSHKey, 'provider_key_ids'> {
  team_id: string;
  provider_key_ids: string;
}

interface UserRow extends Omit<User, 'profile_picture_url'> {
  password_hash: string;
  profile_picture_path: string | null;
  is_active: number;
}

interface SessionRow extends Session {
  token_hash: string;
}

interface AgentMetricsRow {
  machine_id: string;
  agent_version: string;
  hostname: string;
  uptime_seconds: number;
  load_average: string | null;
  memory_total_mb: number;
  memory_used_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  last_heartbeat: string;
}

interface AgentMetrics {
  machine_id: string;
  agent_version: string;
  hostname: string;
  uptime_seconds: number;
  load_average: [number, number, number] | null;
  memory_total_mb: number;
  memory_used_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  last_heartbeat: string;
}

// Database file location
const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'machina.db');

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
  const parts = encryptedData.split(':');
  const ivHex = parts[0];
  const authTagHex = parts[1];
  const encrypted = parts[2];
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
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
    team_id TEXT NOT NULL,
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
    agent_status TEXT DEFAULT 'not_installed',
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
  );

  -- Deployments table
  CREATE TABLE IF NOT EXISTS deployments (
    deployment_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
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
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
  );

  -- Provider accounts table
  CREATE TABLE IF NOT EXISTS provider_accounts (
    provider_account_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    label TEXT NOT NULL,
    credential_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    last_verified_at TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
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
    team_id TEXT,
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
    is_system_profile INTEGER DEFAULT 0,
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
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
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    fingerprint TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    key_type TEXT NOT NULL,
    key_bits INTEGER NOT NULL,
    comment TEXT,
    provider_key_ids TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
  );

  -- SSH key private keys (encrypted separately)
  CREATE TABLE IF NOT EXISTS ssh_key_secrets (
    ssh_key_id TEXT PRIMARY KEY,
    encrypted_private_key TEXT NOT NULL,
    FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(ssh_key_id)
  );

  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    profile_picture_path TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  -- Sessions table
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  -- Teams table
  CREATE TABLE IF NOT EXISTS teams (
    team_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    avatar_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(user_id)
  );

  -- Team Members table
  CREATE TABLE IF NOT EXISTS team_members (
    team_member_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(user_id),
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL,
    invited_by TEXT REFERENCES users(user_id),
    UNIQUE(team_id, user_id)
  );

  -- Team Invites table
  CREATE TABLE IF NOT EXISTS team_invites (
    invite_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    invite_code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(user_id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    used_by TEXT REFERENCES users(user_id)
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(actual_status);
  CREATE INDEX IF NOT EXISTS idx_machines_provider ON machines(provider);
  CREATE INDEX IF NOT EXISTS idx_deployments_machine ON deployments(machine_id);
  CREATE INDEX IF NOT EXISTS idx_deployments_state ON deployments(state);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_ssh_keys_fingerprint ON ssh_keys(fingerprint);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
  CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(team_id);
  CREATE INDEX IF NOT EXISTS idx_team_invites_code ON team_invites(invite_code);
`);

// Add last_health_check column if it doesn't exist
try {
  db.exec('ALTER TABLE machines ADD COLUMN last_health_check TEXT');
} catch {
  // Column already exists, ignore
}

// Add firewall_profile_id column if it doesn't exist
try {
  db.exec('ALTER TABLE machines ADD COLUMN firewall_profile_id TEXT');
} catch {
  // Column already exists, ignore
}

// Add team_id columns to existing tables
try {
  db.exec('ALTER TABLE machines ADD COLUMN team_id TEXT');
} catch {
  // Column already exists, ignore
}

try {
  db.exec('ALTER TABLE deployments ADD COLUMN team_id TEXT');
} catch {
  // Column already exists, ignore
}

try {
  db.exec('ALTER TABLE provider_accounts ADD COLUMN team_id TEXT');
} catch {
  // Column already exists, ignore
}

try {
  db.exec('ALTER TABLE bootstrap_profiles ADD COLUMN team_id TEXT');
} catch {
  // Column already exists, ignore
}

try {
  db.exec('ALTER TABLE ssh_keys ADD COLUMN team_id TEXT');
} catch {
  // Column already exists, ignore
}

// Create indexes for team_id columns
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_machines_team ON machines(team_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_deployments_team ON deployments(team_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_provider_accounts_team ON provider_accounts(team_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bootstrap_profiles_team ON bootstrap_profiles(team_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ssh_keys_team ON ssh_keys(team_id)');
} catch {
  // Indexes already exist, ignore
}

// Add handle column to teams table (for existing databases)
try {
  db.exec('ALTER TABLE teams ADD COLUMN handle TEXT');
  // Generate handles for existing teams (lowercase name with only alphanumeric and hyphens)
  const teams = db.prepare('SELECT team_id, name FROM teams WHERE handle IS NULL').all() as Array<{
    team_id: string;
    name: string;
  }>;
  const updateHandle = db.prepare('UPDATE teams SET handle = ? WHERE team_id = ?');
  const checkHandle = db.prepare('SELECT 1 FROM teams WHERE handle = ?');

  for (const team of teams) {
    let baseHandle = team.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!baseHandle) baseHandle = 'team';

    let handle = baseHandle;
    let counter = 1;
    while (checkHandle.get(handle)) {
      handle = `${baseHandle}-${counter}`;
      counter++;
    }
    updateHandle.run(handle, team.team_id);
  }

  // Now add the NOT NULL and UNIQUE constraints by recreating the table
  // SQLite doesn't support adding constraints to existing columns, so we need to handle this gracefully
  // The UNIQUE index will enforce uniqueness for new handles
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_handle ON teams(handle)');
} catch {
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
} catch {
  // Tables already exist, ignore
}

// Prepared statements for better performance
const statements = {
  // Machines
  getMachines: db.prepare('SELECT * FROM machines ORDER BY created_at DESC'),
  getMachinesByTeam: db.prepare(
    'SELECT * FROM machines WHERE team_id = ? ORDER BY created_at DESC'
  ),
  getMachine: db.prepare('SELECT * FROM machines WHERE machine_id = ?'),
  getMachineWithTeam: db.prepare('SELECT * FROM machines WHERE machine_id = ? AND team_id = ?'),
  insertMachine: db.prepare(`
    INSERT INTO machines (machine_id, team_id, name, provider, provider_account_id, region, zone, size, image,
      desired_status, actual_status, public_ip, private_ip, provider_resource_id, vpc_id, subnet_id,
      created_at, updated_at, tags, terraform_workspace, terraform_state_status, provisioning_method,
      bootstrap_profile_id, firewall_profile_id, agent_status)
    VALUES (@machine_id, @team_id, @name, @provider, @provider_account_id, @region, @zone, @size, @image,
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
  getDeploymentsByTeam: db.prepare(
    'SELECT * FROM deployments WHERE team_id = ? ORDER BY created_at DESC'
  ),
  getDeploymentsByMachine: db.prepare(
    'SELECT * FROM deployments WHERE machine_id = ? ORDER BY created_at DESC'
  ),
  getDeployment: db.prepare('SELECT * FROM deployments WHERE deployment_id = ?'),
  getDeploymentWithTeam: db.prepare(
    'SELECT * FROM deployments WHERE deployment_id = ? AND team_id = ?'
  ),
  insertDeployment: db.prepare(`
    INSERT INTO deployments (deployment_id, team_id, machine_id, type, state, terraform_workspace, created_at,
      started_at, finished_at, initiated_by, plan_summary, outputs, error_message, logs)
    VALUES (@deployment_id, @team_id, @machine_id, @type, @state, @terraform_workspace, @created_at,
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
  getProviderAccountsByTeam: db.prepare(
    'SELECT * FROM provider_accounts WHERE team_id = ? ORDER BY created_at DESC'
  ),
  getProviderAccount: db.prepare('SELECT * FROM provider_accounts WHERE provider_account_id = ?'),
  getProviderAccountWithTeam: db.prepare(
    'SELECT * FROM provider_accounts WHERE provider_account_id = ? AND team_id = ?'
  ),
  insertProviderAccount: db.prepare(`
    INSERT INTO provider_accounts (provider_account_id, team_id, provider_type, label, credential_status, created_at, updated_at, last_verified_at)
    VALUES (@provider_account_id, @team_id, @provider_type, @label, @credential_status, @created_at, @updated_at, @last_verified_at)
  `),
  updateProviderAccount: db.prepare(`
    UPDATE provider_accounts SET
      label = @label, credential_status = @credential_status, updated_at = @updated_at, last_verified_at = @last_verified_at
    WHERE provider_account_id = @provider_account_id
  `),
  deleteProviderAccount: db.prepare('DELETE FROM provider_accounts WHERE provider_account_id = ?'),

  // Credentials
  getCredentials: db.prepare(
    'SELECT encrypted_data FROM credentials WHERE provider_account_id = ?'
  ),
  insertCredentials: db.prepare(
    'INSERT OR REPLACE INTO credentials (provider_account_id, encrypted_data) VALUES (?, ?)'
  ),
  deleteCredentials: db.prepare('DELETE FROM credentials WHERE provider_account_id = ?'),

  // Bootstrap profiles
  getBootstrapProfiles: db.prepare(
    'SELECT * FROM bootstrap_profiles ORDER BY is_system_profile DESC, created_at ASC'
  ),
  getBootstrapProfilesByTeam: db.prepare(
    'SELECT * FROM bootstrap_profiles WHERE team_id = ? OR is_system_profile = 1 ORDER BY is_system_profile DESC, created_at ASC'
  ),
  getBootstrapProfile: db.prepare('SELECT * FROM bootstrap_profiles WHERE profile_id = ?'),
  getBootstrapProfileWithTeam: db.prepare(
    'SELECT * FROM bootstrap_profiles WHERE profile_id = ? AND (team_id = ? OR is_system_profile = 1)'
  ),
  insertBootstrapProfile: db.prepare(`
    INSERT INTO bootstrap_profiles (profile_id, team_id, name, description, method, cloud_init_template,
      ssh_bootstrap_script, ansible_playbook_ref, services_to_run, config_schema, created_at,
      updated_at, created_by, tags, is_system_profile)
    VALUES (@profile_id, @team_id, @name, @description, @method, @cloud_init_template,
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
  getSSHKeysByTeam: db.prepare('SELECT * FROM ssh_keys WHERE team_id = ? ORDER BY created_at DESC'),
  getSSHKey: db.prepare('SELECT * FROM ssh_keys WHERE ssh_key_id = ?'),
  getSSHKeyWithTeam: db.prepare('SELECT * FROM ssh_keys WHERE ssh_key_id = ? AND team_id = ?'),
  getSSHKeyByFingerprint: db.prepare('SELECT * FROM ssh_keys WHERE fingerprint = ?'),
  getSSHKeyByFingerprintAndTeam: db.prepare(
    'SELECT * FROM ssh_keys WHERE fingerprint = ? AND team_id = ?'
  ),
  insertSSHKey: db.prepare(`
    INSERT INTO ssh_keys (ssh_key_id, team_id, name, fingerprint, public_key, key_type, key_bits, comment, provider_key_ids, created_at, updated_at)
    VALUES (@ssh_key_id, @team_id, @name, @fingerprint, @public_key, @key_type, @key_bits, @comment, @provider_key_ids, @created_at, @updated_at)
  `),
  updateSSHKey: db.prepare(`
    UPDATE ssh_keys SET
      name = @name, provider_key_ids = @provider_key_ids, updated_at = @updated_at
    WHERE ssh_key_id = @ssh_key_id
  `),
  deleteSSHKey: db.prepare('DELETE FROM ssh_keys WHERE ssh_key_id = ?'),

  // SSH Key Secrets (encrypted private keys)
  getSSHKeySecret: db.prepare(
    'SELECT encrypted_private_key FROM ssh_key_secrets WHERE ssh_key_id = ?'
  ),
  insertSSHKeySecret: db.prepare(
    'INSERT OR REPLACE INTO ssh_key_secrets (ssh_key_id, encrypted_private_key) VALUES (?, ?)'
  ),
  deleteSSHKeySecret: db.prepare('DELETE FROM ssh_key_secrets WHERE ssh_key_id = ?'),

  // Users
  getUsers: db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC'),
  getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1'),
  getUserCount: db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1'),
  insertUser: db.prepare(`
    INSERT INTO users (user_id, email, password_hash, display_name, profile_picture_path, role, created_at, updated_at, is_active)
    VALUES (@user_id, @email, @password_hash, @display_name, @profile_picture_path, @role, @created_at, @updated_at, @is_active)
  `),
  updateUser: db.prepare(`
    UPDATE users SET
      email = @email, display_name = @display_name, profile_picture_path = @profile_picture_path,
      role = @role, updated_at = @updated_at, last_login_at = @last_login_at
    WHERE user_id = @user_id
  `),
  updateUserPassword: db.prepare(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?'
  ),
  deleteUser: db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE user_id = ?'),

  // Sessions
  getSessions: db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC'),
  getSession: db.prepare('SELECT * FROM sessions WHERE session_id = ?'),
  getSessionByToken: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
  insertSession: db.prepare(`
    INSERT INTO sessions (session_id, user_id, token_hash, ip_address, user_agent, created_at, expires_at, last_activity_at)
    VALUES (@session_id, @user_id, @token_hash, @ip_address, @user_agent, @created_at, @expires_at, @last_activity_at)
  `),
  updateSessionActivity: db.prepare(
    'UPDATE sessions SET last_activity_at = ? WHERE session_id = ?'
  ),
  deleteSession: db.prepare('DELETE FROM sessions WHERE session_id = ?'),
  deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),

  // Teams
  getTeam: db.prepare('SELECT * FROM teams WHERE team_id = ?'),
  insertTeam: db.prepare(`
    INSERT INTO teams (team_id, name, handle, avatar_path, created_at, updated_at, created_by)
    VALUES (@team_id, @name, @handle, @avatar_path, @created_at, @updated_at, @created_by)
  `),
  updateTeam: db.prepare(`
    UPDATE teams SET name = @name, handle = @handle, avatar_path = @avatar_path, updated_at = @updated_at
    WHERE team_id = @team_id
  `),
  getTeamByHandle: db.prepare('SELECT * FROM teams WHERE handle = ?'),
  checkHandleAvailable: db.prepare('SELECT 1 FROM teams WHERE handle = ? AND team_id != ?'),
  deleteTeam: db.prepare('DELETE FROM teams WHERE team_id = ?'),

  // Team Members
  getTeamMembers: db.prepare(`
    SELECT tm.*, u.display_name, u.email, u.profile_picture_path
    FROM team_members tm
    JOIN users u ON tm.user_id = u.user_id
    WHERE tm.team_id = ?
    ORDER BY tm.joined_at ASC
  `),
  getTeamMember: db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?'),
  getTeamMemberById: db.prepare('SELECT * FROM team_members WHERE team_member_id = ?'),
  insertTeamMember: db.prepare(`
    INSERT INTO team_members (team_member_id, team_id, user_id, role, joined_at, invited_by)
    VALUES (@team_member_id, @team_id, @user_id, @role, @joined_at, @invited_by)
  `),
  updateTeamMemberRole: db.prepare('UPDATE team_members SET role = ? WHERE team_member_id = ?'),
  deleteTeamMember: db.prepare('DELETE FROM team_members WHERE team_member_id = ?'),
  countTeamAdmins: db.prepare(
    "SELECT COUNT(*) as count FROM team_members WHERE team_id = ? AND role = 'admin'"
  ),

  // Team Invites
  getTeamInvites: db.prepare(
    'SELECT * FROM team_invites WHERE team_id = ? AND used_at IS NULL ORDER BY created_at DESC'
  ),
  getTeamInviteByCode: db.prepare('SELECT * FROM team_invites WHERE invite_code = ?'),
  getTeamInvite: db.prepare('SELECT * FROM team_invites WHERE invite_id = ?'),
  insertTeamInvite: db.prepare(`
    INSERT INTO team_invites (invite_id, team_id, invite_code, created_by, created_at, expires_at)
    VALUES (@invite_id, @team_id, @invite_code, @created_by, @created_at, @expires_at)
  `),
  markInviteUsed: db.prepare(
    'UPDATE team_invites SET used_at = ?, used_by = ? WHERE invite_id = ?'
  ),
  deleteTeamInvite: db.prepare('DELETE FROM team_invites WHERE invite_id = ?'),

  // User's teams
  getUserTeams: db.prepare(`
    SELECT t.*, tm.role,
      (SELECT COUNT(*) FROM team_members WHERE team_id = t.team_id) as member_count
    FROM teams t
    JOIN team_members tm ON t.team_id = tm.team_id
    WHERE tm.user_id = ?
    ORDER BY t.created_at ASC
  `),
};

// Helper to parse JSON fields from DB rows
function parseMachine(row: MachineRow): Machine {
  const { tags, last_health_check, ...rest } = row;
  return {
    ...rest,
    tags: JSON.parse(tags || '{}'),
    ...(last_health_check ? { last_health_check } : {}),
  };
}

function parseDeployment(row: DeploymentRow): Deployment {
  let parsedLogs: DeploymentLog[] | undefined = row.logs ? JSON.parse(row.logs) : undefined;
  // Historical bug: logs were sometimes double-JSON-encoded, so JSON.parse(row.logs)
  // produced a string that itself contains JSON. Try to unwrap once more.
  if (typeof parsedLogs === 'string') {
    try {
      parsedLogs = JSON.parse(parsedLogs);
    } catch {
      // ignore
    }
  }
  // Omit raw string fields that need parsing
  const { logs: _rawLogs, plan_summary: _rawPlan, outputs: _rawOutputs, ...rest } = row;
  return {
    ...rest,
    ...(row.plan_summary && { plan_summary: JSON.parse(row.plan_summary) }),
    ...(row.outputs && { outputs: JSON.parse(row.outputs) }),
    ...(parsedLogs && { logs: parsedLogs }),
  } as Deployment;
}

function serializeJsonField(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  // If callers provide a JSON string, assume it's already serialized.
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseBootstrapProfile(row: BootstrapProfileRow): BootstrapProfile {
  // Destructure to omit team_id from spread, handle it separately
  const { team_id, services_to_run, config_schema, tags, is_system_profile, ...rest } = row;
  const profile: BootstrapProfile = {
    ...rest,
    services_to_run: JSON.parse(services_to_run || '[]'),
    config_schema: config_schema ? JSON.parse(config_schema) : undefined,
    tags: tags ? JSON.parse(tags) : undefined,
    is_system_profile: Boolean(is_system_profile),
  };
  if (team_id) {
    profile.team_id = team_id;
  }
  return profile;
}

function parseFirewallProfile(row: FirewallProfileRow): FirewallProfile {
  return {
    ...row,
    rules: JSON.parse(row.rules || '[]'),
  };
}

function parseAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    ...row,
    details: row.details ? JSON.parse(row.details) : undefined,
  };
}

function parseSSHKey(row: SSHKeyRow): SSHKey {
  return {
    ...row,
    provider_key_ids: JSON.parse(row.provider_key_ids || '{}'),
  };
}

function parseUser(row: UserRow): User {
  const user: User = {
    user_id: row.user_id,
    email: row.email,
    display_name: row.display_name,
    role: row.role as User['role'],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (row.profile_picture_path) {
    user.profile_picture_url = row.profile_picture_path;
  }
  if (row.last_login_at) {
    user.last_login_at = row.last_login_at;
  }
  return user;
}

function parseUserWithPassword(row: UserRow): User & { password_hash: string } {
  return {
    ...parseUser(row),
    password_hash: row.password_hash,
  };
}

// Database operations
export const database = {
  // Machines
  getMachines(): Machine[] {
    return (statements.getMachines.all() as MachineRow[]).map(parseMachine);
  },
  getMachinesByTeam(teamId: string): Machine[] {
    return (statements.getMachinesByTeam.all(teamId) as MachineRow[]).map(parseMachine);
  },
  getMachine(id: string): Machine | undefined {
    const row = statements.getMachine.get(id) as MachineRow | undefined;
    return row ? parseMachine(row) : undefined;
  },
  getMachineWithTeam(id: string, teamId: string): Machine | undefined {
    const row = statements.getMachineWithTeam.get(id, teamId) as MachineRow | undefined;
    return row ? parseMachine(row) : undefined;
  },
  insertMachine(machine: Machine): void {
    statements.insertMachine.run({
      ...machine,
      team_id: machine.team_id,
      public_ip: machine.public_ip || null,
      private_ip: machine.private_ip || null,
      provider_resource_id: machine.provider_resource_id || null,
      vpc_id: machine.vpc_id || null,
      subnet_id: machine.subnet_id || null,
      firewall_profile_id: machine.firewall_profile_id || null,
      tags: JSON.stringify(machine.tags || {}),
    });
  },
  updateMachine(
    machine: Partial<Machine> & { machine_id: string; last_health_check?: string }
  ): void {
    const existing = this.getMachine(machine.machine_id);
    if (!existing) return;
    const existingRow = statements.getMachine.get(machine.machine_id) as MachineRow | undefined;
    statements.updateMachine.run({
      ...existing,
      ...machine,
      tags: JSON.stringify(machine.tags || existing.tags || {}),
      last_health_check: machine.last_health_check || existingRow?.last_health_check || null,
    });
  },
  deleteMachine(id: string): void {
    statements.deleteMachine.run(id);
  },

  // Agent metrics
  getAgentMetrics(machineId: string): AgentMetrics | null {
    const row = statements.getAgentMetrics.get(machineId) as AgentMetricsRow | undefined;
    if (!row) return null;
    return {
      ...row,
      load_average: row.load_average ? JSON.parse(row.load_average) : null,
    };
  },
  updateAgentMetrics(
    machineId: string,
    metrics: {
      agent_version: string;
      hostname: string;
      uptime_seconds: number;
      load_average: [number, number, number];
      memory_total_mb: number;
      memory_used_mb: number;
      disk_total_gb: number;
      disk_used_gb: number;
      last_heartbeat: string;
    }
  ): void {
    statements.upsertAgentMetrics.run({
      machine_id: machineId,
      ...metrics,
      load_average: JSON.stringify(metrics.load_average),
    });
  },

  // Deployments
  getDeployments(): Deployment[] {
    return (statements.getDeployments.all() as DeploymentRow[]).map(parseDeployment);
  },
  getDeploymentsByTeam(teamId: string): Deployment[] {
    return (statements.getDeploymentsByTeam.all(teamId) as DeploymentRow[]).map(parseDeployment);
  },
  getDeploymentsByMachine(machineId: string): Deployment[] {
    return (statements.getDeploymentsByMachine.all(machineId) as DeploymentRow[]).map(
      parseDeployment
    );
  },
  getDeployment(id: string): Deployment | undefined {
    const row = statements.getDeployment.get(id) as DeploymentRow | undefined;
    return row ? parseDeployment(row) : undefined;
  },
  getDeploymentWithTeam(id: string, teamId: string): Deployment | undefined {
    const row = statements.getDeploymentWithTeam.get(id, teamId) as DeploymentRow | undefined;
    return row ? parseDeployment(row) : undefined;
  },
  insertDeployment(deployment: Deployment): void {
    statements.insertDeployment.run({
      ...deployment,
      team_id: deployment.team_id,
      started_at: deployment.started_at || null,
      finished_at: deployment.finished_at || null,
      initiated_by: deployment.initiated_by || null,
      plan_summary: deployment.plan_summary ? JSON.stringify(deployment.plan_summary) : null,
      outputs: deployment.outputs ? JSON.stringify(deployment.outputs) : null,
      error_message: deployment.error_message || null,
      logs: null,
    });
  },
  updateDeployment(
    deployment: Partial<Deployment> & { deployment_id: string; logs?: DeploymentLog[] }
  ): void {
    const existing = this.getDeployment(deployment.deployment_id);
    if (!existing) return;
    statements.updateDeployment.run({
      deployment_id: deployment.deployment_id,
      state: deployment.state || existing.state,
      finished_at: deployment.finished_at || existing.finished_at || null,
      plan_summary: deployment.plan_summary
        ? JSON.stringify(deployment.plan_summary)
        : existing.plan_summary
          ? JSON.stringify(existing.plan_summary)
          : null,
      outputs: deployment.outputs
        ? JSON.stringify(deployment.outputs)
        : existing.outputs
          ? JSON.stringify(existing.outputs)
          : null,
      error_message: deployment.error_message || existing.error_message || null,
      // Preserve existing logs unless explicitly provided.
      logs:
        deployment.logs !== undefined
          ? serializeJsonField(deployment.logs)
          : serializeJsonField(existing.logs),
    });
  },

  // Provider accounts
  getProviderAccounts(): ProviderAccount[] {
    return statements.getProviderAccounts.all() as ProviderAccount[];
  },
  getProviderAccountsByTeam(teamId: string): ProviderAccount[] {
    return statements.getProviderAccountsByTeam.all(teamId) as ProviderAccount[];
  },
  getProviderAccount(id: string): ProviderAccount | undefined {
    return statements.getProviderAccount.get(id) as ProviderAccount | undefined;
  },
  getProviderAccountWithTeam(id: string, teamId: string): ProviderAccount | undefined {
    return statements.getProviderAccountWithTeam.get(id, teamId) as ProviderAccount | undefined;
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
    return (statements.getBootstrapProfiles.all() as BootstrapProfileRow[]).map(
      parseBootstrapProfile
    );
  },
  getBootstrapProfilesByTeam(teamId: string): BootstrapProfile[] {
    return (statements.getBootstrapProfilesByTeam.all(teamId) as BootstrapProfileRow[]).map(
      parseBootstrapProfile
    );
  },
  getBootstrapProfile(id: string): BootstrapProfile | undefined {
    const row = statements.getBootstrapProfile.get(id) as BootstrapProfileRow | undefined;
    return row ? parseBootstrapProfile(row) : undefined;
  },
  getBootstrapProfileWithTeam(id: string, teamId: string): BootstrapProfile | undefined {
    const row = statements.getBootstrapProfileWithTeam.get(id, teamId) as
      | BootstrapProfileRow
      | undefined;
    return row ? parseBootstrapProfile(row) : undefined;
  },
  insertBootstrapProfile(profile: BootstrapProfile): void {
    statements.insertBootstrapProfile.run({
      profile_id: profile.profile_id,
      team_id: profile.team_id || null,
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
      config_schema: profile.config_schema
        ? JSON.stringify(profile.config_schema)
        : existing.config_schema
          ? JSON.stringify(existing.config_schema)
          : null,
      tags: profile.tags
        ? JSON.stringify(profile.tags)
        : existing.tags
          ? JSON.stringify(existing.tags)
          : null,
    });
  },
  deleteBootstrapProfile(id: string): void {
    statements.deleteBootstrapProfile.run(id);
  },

  // Firewall profiles
  getFirewallProfiles(): FirewallProfile[] {
    return (statements.getFirewallProfiles.all() as FirewallProfileRow[]).map(parseFirewallProfile);
  },
  getFirewallProfile(id: string): FirewallProfile | undefined {
    const row = statements.getFirewallProfile.get(id) as FirewallProfileRow | undefined;
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
    return (statements.getAuditEvents.all() as AuditEventRow[]).map(parseAuditEvent);
  },
  insertAuditEvent(event: AuditEvent): void {
    statements.insertAuditEvent.run({
      ...event,
      details: event.details ? JSON.stringify(event.details) : null,
    });
  },

  // SSH Keys
  getSSHKeys(): SSHKey[] {
    return (statements.getSSHKeys.all() as SSHKeyRow[]).map(parseSSHKey);
  },
  getSSHKeysByTeam(teamId: string): SSHKey[] {
    return (statements.getSSHKeysByTeam.all(teamId) as SSHKeyRow[]).map(parseSSHKey);
  },
  getSSHKey(id: string): SSHKey | undefined {
    const row = statements.getSSHKey.get(id) as SSHKeyRow | undefined;
    return row ? parseSSHKey(row) : undefined;
  },
  getSSHKeyWithTeam(id: string, teamId: string): SSHKey | undefined {
    const row = statements.getSSHKeyWithTeam.get(id, teamId) as SSHKeyRow | undefined;
    return row ? parseSSHKey(row) : undefined;
  },
  getSSHKeyByFingerprint(fingerprint: string): SSHKey | undefined {
    const row = statements.getSSHKeyByFingerprint.get(fingerprint) as SSHKeyRow | undefined;
    return row ? parseSSHKey(row) : undefined;
  },
  getSSHKeyByFingerprintAndTeam(fingerprint: string, teamId: string): SSHKey | undefined {
    const row = statements.getSSHKeyByFingerprintAndTeam.get(fingerprint, teamId) as
      | SSHKeyRow
      | undefined;
    return row ? parseSSHKey(row) : undefined;
  },
  insertSSHKey(key: SSHKey): void {
    statements.insertSSHKey.run({
      ...key,
      team_id: key.team_id,
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
    const row = statements.getSSHKeySecret.get(keyId) as
      | { encrypted_private_key: string }
      | undefined;
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

  // Users
  getUsers(): User[] {
    return (statements.getUsers.all() as UserRow[]).map(parseUser);
  },
  getUser(id: string): (User & { password_hash: string }) | undefined {
    const row = statements.getUser.get(id) as UserRow | undefined;
    return row ? parseUserWithPassword(row) : undefined;
  },
  getUserByEmail(email: string): (User & { password_hash: string }) | undefined {
    const row = statements.getUserByEmail.get(email.toLowerCase()) as UserRow | undefined;
    return row ? parseUserWithPassword(row) : undefined;
  },
  getUserCount(): number {
    const result = statements.getUserCount.get() as { count: number };
    return result.count;
  },
  insertUser(user: User & { password_hash: string }): void {
    statements.insertUser.run({
      user_id: user.user_id,
      email: user.email.toLowerCase(),
      password_hash: user.password_hash,
      display_name: user.display_name,
      profile_picture_path: null,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_active: 1,
    });
  },
  updateUser(user: Partial<User> & { user_id: string }): void {
    const existing = this.getUser(user.user_id);
    if (!existing) return;
    statements.updateUser.run({
      user_id: user.user_id,
      email: user.email?.toLowerCase() || existing.email,
      display_name: user.display_name || existing.display_name,
      profile_picture_path: user.profile_picture_url || null,
      role: user.role || existing.role,
      updated_at: new Date().toISOString(),
      last_login_at: user.last_login_at || existing.last_login_at || null,
    });
  },
  updateUserPassword(userId: string, passwordHash: string): void {
    statements.updateUserPassword.run(passwordHash, new Date().toISOString(), userId);
  },
  updateUserLastLogin(userId: string): void {
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE user_id = ?').run(
      now,
      now,
      userId
    );
  },
  updateUserProfilePicture(userId: string, path: string | null): void {
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET profile_picture_path = ?, updated_at = ? WHERE user_id = ?').run(
      path,
      now,
      userId
    );
  },
  deleteUser(id: string): void {
    // Soft delete - set is_active = 0
    statements.deleteUser.run(new Date().toISOString(), id);
    // Also delete all sessions
    statements.deleteUserSessions.run(id);
  },

  // Sessions
  getSessions(userId: string): Session[] {
    return statements.getSessions.all(userId) as Session[];
  },
  getSession(id: string): SessionRow | undefined {
    return statements.getSession.get(id) as SessionRow | undefined;
  },
  getSessionByToken(tokenHash: string): SessionRow | undefined {
    return statements.getSessionByToken.get(tokenHash) as SessionRow | undefined;
  },
  insertSession(session: Session & { token_hash: string }): void {
    statements.insertSession.run(session);
  },
  updateSessionActivity(sessionId: string): void {
    statements.updateSessionActivity.run(new Date().toISOString(), sessionId);
  },
  deleteSession(id: string): void {
    statements.deleteSession.run(id);
  },
  deleteUserSessions(userId: string): void {
    statements.deleteUserSessions.run(userId);
  },
  cleanupExpiredSessions(): number {
    const result = statements.deleteExpiredSessions.run(new Date().toISOString());
    return result.changes;
  },

  // Teams
  getTeam(id: string): Team | undefined {
    const row = statements.getTeam.get(id) as
      | {
          team_id: string;
          name: string;
          handle: string;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
          created_by: string;
        }
      | undefined;
    if (!row) return undefined;
    return {
      team_id: row.team_id,
      name: row.name,
      handle: row.handle,
      avatar_url: row.avatar_path ? `/api/teams/avatars/${row.avatar_path}` : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
    };
  },
  getTeamByHandle(handle: string): Team | undefined {
    const row = statements.getTeamByHandle.get(handle) as
      | {
          team_id: string;
          name: string;
          handle: string;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
          created_by: string;
        }
      | undefined;
    if (!row) return undefined;
    return {
      team_id: row.team_id,
      name: row.name,
      handle: row.handle,
      avatar_url: row.avatar_path ? `/api/teams/avatars/${row.avatar_path}` : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
    };
  },
  isHandleAvailable(handle: string, excludeTeamId?: string): boolean {
    const result = statements.checkHandleAvailable.get(handle, excludeTeamId || '') as
      | { 1: number }
      | undefined;
    // Also check if handle exists at all for new teams
    if (!excludeTeamId) {
      const existing = statements.getTeamByHandle.get(handle);
      return !existing;
    }
    return !result;
  },
  getUserTeams(userId: string): TeamWithMembership[] {
    const rows = statements.getUserTeams.all(userId) as Array<{
      team_id: string;
      name: string;
      handle: string;
      avatar_path: string | null;
      created_at: string;
      updated_at: string;
      created_by: string;
      role: 'admin' | 'member';
      member_count: number;
    }>;
    return rows.map((row) => ({
      team_id: row.team_id,
      name: row.name,
      handle: row.handle,
      avatar_url: row.avatar_path ? `/api/teams/avatars/${row.avatar_path}` : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      role: row.role,
      member_count: row.member_count,
    }));
  },
  insertTeam(team: Team): void {
    statements.insertTeam.run({
      team_id: team.team_id,
      name: team.name,
      handle: team.handle,
      avatar_path: null,
      created_at: team.created_at,
      updated_at: team.updated_at,
      created_by: team.created_by,
    });
  },
  updateTeam(
    teamId: string,
    updates: { name?: string; handle?: string; avatar_path?: string | null }
  ): void {
    const existing = statements.getTeam.get(teamId) as
      | { name: string; handle: string; avatar_path: string | null }
      | undefined;
    if (!existing) return;
    statements.updateTeam.run({
      team_id: teamId,
      name: updates.name ?? existing.name,
      handle: updates.handle ?? existing.handle,
      avatar_path: updates.avatar_path !== undefined ? updates.avatar_path : existing.avatar_path,
      updated_at: new Date().toISOString(),
    });
  },
  deleteTeam(id: string): void {
    statements.deleteTeam.run(id);
  },

  // Team Members
  getTeamMembers(teamId: string): TeamMemberWithUser[] {
    const rows = statements.getTeamMembers.all(teamId) as Array<{
      team_member_id: string;
      team_id: string;
      user_id: string;
      role: 'admin' | 'member';
      joined_at: string;
      invited_by: string | null;
      display_name: string;
      email: string;
      profile_picture_path: string | null;
    }>;
    return rows.map((row) => ({
      team_member_id: row.team_member_id,
      team_id: row.team_id,
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      invited_by: row.invited_by || undefined,
      user: {
        user_id: row.user_id,
        display_name: row.display_name,
        email: row.email,
        profile_picture_url: row.profile_picture_path
          ? `/api/auth/avatars/${row.profile_picture_path}`
          : undefined,
      },
    }));
  },
  getTeamMember(teamId: string, userId: string): TeamMember | undefined {
    return statements.getTeamMember.get(teamId, userId) as TeamMember | undefined;
  },
  getTeamMemberById(memberId: string): TeamMember | undefined {
    return statements.getTeamMemberById.get(memberId) as TeamMember | undefined;
  },
  insertTeamMember(member: TeamMember): void {
    statements.insertTeamMember.run({
      team_member_id: member.team_member_id,
      team_id: member.team_id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      invited_by: member.invited_by || null,
    });
  },
  updateTeamMemberRole(memberId: string, role: 'admin' | 'member'): void {
    statements.updateTeamMemberRole.run(role, memberId);
  },
  deleteTeamMember(memberId: string): void {
    statements.deleteTeamMember.run(memberId);
  },
  countTeamAdmins(teamId: string): number {
    const result = statements.countTeamAdmins.get(teamId) as { count: number };
    return result.count;
  },

  // Team Invites
  getTeamInvites(teamId: string): TeamInvite[] {
    return statements.getTeamInvites.all(teamId) as TeamInvite[];
  },
  getTeamInviteByCode(code: string): TeamInvite | undefined {
    return statements.getTeamInviteByCode.get(code) as TeamInvite | undefined;
  },
  getTeamInvite(inviteId: string): TeamInvite | undefined {
    return statements.getTeamInvite.get(inviteId) as TeamInvite | undefined;
  },
  insertTeamInvite(invite: TeamInvite): void {
    statements.insertTeamInvite.run({
      invite_id: invite.invite_id,
      team_id: invite.team_id,
      invite_code: invite.invite_code,
      created_by: invite.created_by,
      created_at: invite.created_at,
      expires_at: invite.expires_at,
    });
  },
  markInviteUsed(inviteId: string, usedBy: string): void {
    statements.markInviteUsed.run(new Date().toISOString(), usedBy, inviteId);
  },
  deleteTeamInvite(inviteId: string): void {
    statements.deleteTeamInvite.run(inviteId);
  },

  // Create default team for new user
  createDefaultTeam(userId: string, displayName: string): Team {
    const teamId = `team_${crypto.randomUUID().replace(/-/g, '').substring(0, 20)}`;
    const now = new Date().toISOString();

    // Generate a unique handle from display name
    let baseHandle = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!baseHandle) baseHandle = 'my-team';

    let handle = baseHandle;
    let counter = 1;
    while (!this.isHandleAvailable(handle)) {
      handle = `${baseHandle}-${counter}`;
      counter++;
    }

    const team: Team = {
      team_id: teamId,
      name: 'My Team',
      handle,
      created_at: now,
      updated_at: now,
      created_by: userId,
    };

    this.insertTeam(team);

    // Add user as admin
    const memberId = `tmem_${crypto.randomUUID().replace(/-/g, '').substring(0, 20)}`;
    const member: TeamMember = {
      team_member_id: memberId,
      team_id: teamId,
      user_id: userId,
      role: 'admin',
      joined_at: now,
    };

    this.insertTeamMember(member);

    return team;
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
    homedir: /home/grid

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
        ports: [36900],
      },
    ],
    config_schema: [
      {
        name: 'GRID_NODE_ID',
        type: 'string',
        description: 'Unique node identifier',
        required: false,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'system',
    tags: ['production', 'grid', 'rust'],
    is_system_profile: true,
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
        {
          rule_id: 'r1',
          direction: 'inbound',
          protocol: 'tcp',
          port_range_start: 22,
          port_range_end: 22,
          source_addresses: ['0.0.0.0/0'],
          description: 'SSH',
          source: 'provider',
        },
        {
          rule_id: 'r2',
          direction: 'inbound',
          protocol: 'tcp',
          port_range_start: 36900,
          port_range_end: 36900,
          source_addresses: ['0.0.0.0/0'],
          description: 'The Grid',
          source: 'provider',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
    description:
      'Deploys the Machine infrastructure management dashboard with Node.js and Terraform',
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
    homedir: /home/machine

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
    # Create environment file for the service.
    # NOTE: This must be valid YAML, so keep this logic in runcmd (not embedded unindented in write_files).
    PUBLIC_IP=$(curl -s --max-time 10 ifconfig.me || curl -s --max-time 10 api.ipify.org || echo "localhost")
    cat > /etc/machine-dashboard.env <<EOF
    NODE_ENV=production
    PORT=3001
    PUBLIC_SERVER_URL=http://$PUBLIC_IP
    CORS_ORIGIN=*
    EOF
    chmod 0644 /etc/machine-dashboard.env
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
        ports: [3001],
      },
      {
        service_name: 'nginx',
        display_name: 'Nginx',
        systemd_unit: 'nginx.service',
        restart_command: 'systemctl restart nginx',
        ports: [80],
      },
    ],
    config_schema: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'system',
    tags: ['production', 'dashboard', 'node'],
    is_system_profile: true,
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
        {
          rule_id: 'r1',
          direction: 'inbound',
          protocol: 'tcp',
          port_range_start: 22,
          port_range_end: 22,
          source_addresses: ['0.0.0.0/0'],
          description: 'SSH',
          source: 'provider',
        },
        {
          rule_id: 'r2',
          direction: 'inbound',
          protocol: 'tcp',
          port_range_start: 80,
          port_range_end: 80,
          source_addresses: ['0.0.0.0/0'],
          description: 'HTTP',
          source: 'provider',
        },
        {
          rule_id: 'r3',
          direction: 'inbound',
          protocol: 'tcp',
          port_range_start: 443,
          port_range_end: 443,
          source_addresses: ['0.0.0.0/0'],
          description: 'HTTPS',
          source: 'provider',
        },
        {
          rule_id: 'r4',
          direction: 'inbound',
          protocol: 'tcp',
          port_range_start: 3001,
          port_range_end: 3001,
          source_addresses: ['0.0.0.0/0'],
          description: 'API Direct',
          source: 'provider',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

// Run seed on import
seedDefaults();

console.log('✓ SQLite database initialized at', DB_PATH);

export default database;
