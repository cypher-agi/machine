// ============ Integration Framework Types ============

/**
 * Supported integration types
 * Add new types here when implementing new integrations
 */
export type IntegrationType = 'github' | 'slack' | 'discord' | 'x';

/**
 * Integration status
 */
export type IntegrationStatus = 'active' | 'suspended' | 'error' | 'disconnected';

/**
 * Sync status for imported data
 */
export type SyncStatus = 'ok' | 'error' | 'removed' | 'pending';

/**
 * Sync operation status
 */
export type SyncOperationStatus = 'idle' | 'in_progress' | 'success' | 'error';

// ============ Integration Definition (Registry) ============

/**
 * Defines a supported integration type
 * This is code-defined, not stored in DB
 */
export interface IntegrationDefinition {
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  available: boolean;
  docsUrl?: string;
  features: string[];
  requiredScopes: string[];
}

// ============ Team Integration (Base) ============

/**
 * A team's connection to an integration provider
 */
export interface TeamIntegration {
  integration_id: string;
  team_id: string;
  type: IntegrationType;
  status: IntegrationStatus;

  // External provider identity
  external_id: string; // e.g., GitHub installation_id
  external_account_id?: string; // e.g., GitHub org_id
  external_account_name: string; // e.g., GitHub org login
  external_account_avatar?: string;

  // Connection metadata
  connected_by_user_id: string;
  connected_by_external_id?: string; // e.g., GitHub user who installed
  connected_by_external_name?: string;

  // Sync state
  last_sync_at?: string;
  last_sync_status?: SyncOperationStatus;
  last_sync_error?: string;
  next_sync_at?: string;

  // Provider-specific config (non-sensitive)
  config?: Record<string, unknown>;

  created_at: string;
  updated_at: string;
}

/**
 * Integration with stats for list views
 */
export interface TeamIntegrationWithStats extends TeamIntegration {
  stats?: {
    [key: string]: number;
  };
}

// ============ API Types ============

export interface IntegrationStatusResponse {
  connected: boolean;
  configured: boolean; // Team has OAuth credentials configured
  integration?: TeamIntegration;
  stats?: Record<string, number>;
  definition: IntegrationDefinition;
}

export interface ConnectStartResponse {
  url: string;
  state?: string;
}

export interface SyncResponse {
  success: boolean;
  started_at: string;
  items_synced?: number;
}

export interface IntegrationListItem extends IntegrationDefinition {
  connected: boolean;
  configured: boolean; // Team has OAuth credentials configured
}

// ============ Integration Setup Types ============

/**
 * Setup info returned for wizard - tells user what they need to configure
 */
export interface IntegrationSetupInfo {
  type: IntegrationType;
  name: string;
  steps: IntegrationSetupStep[];
  callbackUrl: string; // URL user needs for OAuth app setup
}

export interface IntegrationSetupStep {
  id: string;
  title: string;
  description: string;
  externalUrl?: string; // Link to external service (e.g., GitHub developer settings)
  fields?: IntegrationSetupField[];
}

export interface IntegrationSetupField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  required: boolean;
  helpText?: string;
}

/**
 * Credentials submitted by user during setup
 */
export interface GitHubOAuthCredentials {
  client_id: string;
  client_secret: string;
}

export interface IntegrationSetupRequest {
  type: IntegrationType;
  credentials: GitHubOAuthCredentials; // Union with other types as needed
}

// ============ GitHub-Specific Types ============

export type GitHubRepoSelection = 'all' | 'selected';

export interface GitHubConfig {
  repo_selection: GitHubRepoSelection;
  selected_repo_ids?: number[];
}

export interface GitHubRepository {
  repo_id: string;
  team_id: string;
  integration_id: string;
  github_repo_id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  archived: boolean;
  disabled: boolean;
  default_branch: string;
  html_url: string;
  language?: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at?: string;
  sync_status: SyncStatus;
  last_error?: string;
  imported_at: string;
  updated_at: string;
}

export interface GitHubMember {
  member_id: string;
  team_id: string;
  integration_id: string;
  github_user_id: number;
  login: string;
  avatar_url?: string;
  html_url: string;
  organization: string;
  role?: 'admin' | 'member';
  sync_status: SyncStatus;
  last_error?: string;
  imported_at: string;
  updated_at: string;
}

// ============ Filter Types ============

export interface GitHubRepoFilter {
  search?: string;
  visibility?: 'public' | 'private' | 'all';
  archived?: boolean;
  language?: string;
  sync_status?: SyncStatus;
}

export interface GitHubMemberFilter {
  search?: string;
  role?: 'admin' | 'member';
  sync_status?: SyncStatus;
}

// ============ Future Integration Types (Stubs) ============

export interface SlackConfig {
  workspace_id: string;
  workspace_name: string;
}

export interface DiscordConfig {
  guild_id: string;
  guild_name: string;
}
