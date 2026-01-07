# Integrations App Spec — Generalized Integration Framework

> A secure, extensible framework for third-party service integrations with GitHub MVP

---

## Overview

The **Integrations** framework provides a unified abstraction for connecting third-party services (GitHub, Slack, Discord, X, etc.) to the app. The architecture ensures:

1. **Extensibility** — Adding new integrations follows a consistent pattern
2. **Security** — Per-team credential isolation with defense-in-depth
3. **Consistency** — Common UI patterns across all integration types

**MVP Focus**: GitHub Organization integration with repos/members import.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Security Model](#security-model)
3. [Data Model](#data-model)
4. [Shared Types](#shared-types)
5. [Backend Services](#backend-services)
6. [Backend API](#backend-api)
7. [Database Schema](#database-schema)
8. [Frontend Components](#frontend-components)
9. [Implementation Checklist](#implementation-checklist)

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Integration Framework                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐ │
│  │ IntegrationRouter│───▶│IntegrationService│───▶│ CredentialVault│ │
│  │  /integrations/* │    │    (abstract)    │    │  (encrypted)   │ │
│  └──────────────────┘    └────────┬─────────┘    └────────────────┘ │
│                                   │                                  │
│            ┌──────────────────────┼──────────────────────┐          │
│            ▼                      ▼                      ▼          │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│  │ GitHubService   │   │  SlackService   │   │ DiscordService  │   │
│  │  implements     │   │   implements    │   │   implements    │   │
│  │  Integration    │   │   Integration   │   │   Integration   │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Integration Type** | A supported provider (github, slack, discord, x) |
| **Integration Definition** | Metadata about a provider (name, scopes, config schema) |
| **Team Integration** | An activated connection between a team and a provider |
| **Credential Vault** | Secure, encrypted storage for OAuth tokens and secrets |
| **Integration Service** | Provider-specific implementation of sync/connect logic |

---

## Security Model

### Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Credential theft from DB** | Attacker gets all team tokens | Per-team encryption keys, AAD binding |
| **Cross-team data access (IDOR)** | Team A accesses Team B's integrations | Team ID in all queries + middleware validation |
| **Token replay** | Stolen token used maliciously | Short-lived tokens, rotation, audit logging |
| **Callback hijacking** | Attacker intercepts OAuth callback | State parameter with HMAC, short TTL |
| **Insider threat** | Malicious admin | Audit logs, principle of least privilege |
| **Key compromise** | Master encryption key leaked | Key rotation capability, HSM option |

### Credential Isolation Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Credential Security Layers                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Layer 1: Access Control                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  requireAuth → requireTeamContext → requireTeamAdmin               │ │
│  │  • User must be authenticated                                      │ │
│  │  • User must be member of team                                     │ │
│  │  • User must be admin for write operations                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Layer 2: Query-Level Isolation                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ALL queries include team_id filter                                │ │
│  │  • WHERE team_id = ?                                               │ │
│  │  • Parameterized queries (no SQL injection)                        │ │
│  │  • Foreign keys enforce referential integrity                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Layer 3: Per-Team Encryption                                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Derived Key = HKDF(master_key, team_id, "integration-creds")      │ │
│  │  • Each team has unique derived encryption key                     │ │
│  │  • team_id bound as AAD (additional authenticated data)            │ │
│  │  • Compromise of one team's data doesn't expose others             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Layer 4: Audit Trail                                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Every credential access is logged:                                │ │
│  │  • Who accessed (user_id)                                          │ │
│  │  • What was accessed (integration_id)                              │ │
│  │  • When (timestamp)                                                │ │
│  │  • Why (operation: connect, sync, disconnect)                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Per-Team Key Derivation

```typescript
// server/src/services/credentialVault.ts

import * as crypto from 'crypto';

const MASTER_KEY = process.env.ENCRYPTION_KEY!;
const ALGORITHM = 'aes-256-gcm';

/**
 * Derive a team-specific encryption key using HKDF
 * This ensures each team's credentials are encrypted with a unique key
 */
function deriveTeamKey(teamId: string): Buffer {
  // Use HKDF to derive team-specific key from master key
  const salt = Buffer.from('machina-integration-v1', 'utf8');
  const info = Buffer.from(`team:${teamId}:credentials`, 'utf8');
  
  return crypto.hkdfSync(
    'sha256',
    Buffer.from(MASTER_KEY, 'hex'),
    salt,
    info,
    32 // 256 bits
  );
}

/**
 * Encrypt credentials with team-specific key and AAD binding
 */
export function encryptCredentials(
  teamId: string, 
  integrationId: string,
  credentials: Record<string, unknown>
): string {
  const key = deriveTeamKey(teamId);
  const iv = crypto.randomBytes(16);
  
  // AAD binds the ciphertext to this specific team and integration
  // Prevents ciphertext from being "moved" to another team
  const aad = Buffer.from(`${teamId}:${integrationId}`, 'utf8');
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);
  
  const plaintext = JSON.stringify(credentials);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt credentials - validates team binding
 */
export function decryptCredentials(
  teamId: string,
  integrationId: string, 
  encryptedData: string
): Record<string, unknown> {
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted credential format');
  }
  
  const key = deriveTeamKey(teamId);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const aad = Buffer.from(`${teamId}:${integrationId}`, 'utf8');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}
```

### OAuth State Security

```typescript
/**
 * Generate secure OAuth state with HMAC
 * Prevents CSRF and callback hijacking
 */
export function generateOAuthState(teamId: string, userId: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${teamId}:${userId}:${timestamp}:${nonce}`;
  
  // HMAC prevents tampering
  const hmac = crypto.createHmac('sha256', MASTER_KEY)
    .update(payload)
    .digest('hex');
  
  // Base64 encode for URL safety
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

/**
 * Validate OAuth state - checks HMAC and expiry
 */
export function validateOAuthState(
  state: string, 
  maxAgeMs: number = 10 * 60 * 1000 // 10 minutes
): { teamId: string; userId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;
    
    const [teamId, userId, timestampStr, nonce, providedHmac] = parts;
    const timestamp = parseInt(timestampStr!, 10);
    
    // Check expiry
    if (Date.now() - timestamp > maxAgeMs) return null;
    
    // Verify HMAC
    const payload = `${teamId}:${userId}:${timestamp}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', MASTER_KEY)
      .update(payload)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(providedHmac!), 
      Buffer.from(expectedHmac)
    )) {
      return null;
    }
    
    return { teamId: teamId!, userId: userId! };
  } catch {
    return null;
  }
}
```

### Security Audit Logging

```typescript
// All credential operations are logged
interface CredentialAuditEvent {
  event_id: string;
  action: 'credential.accessed' | 'credential.stored' | 'credential.deleted';
  team_id: string;
  integration_id: string;
  integration_type: string;
  user_id: string;
  operation: 'connect' | 'sync' | 'disconnect' | 'verify';
  ip_address?: string;
  timestamp: string;
}

// Called automatically by credential vault
function logCredentialAccess(event: CredentialAuditEvent): void {
  database.insertAuditEvent({
    event_id: `evt_${uuidv4()}`,
    action: event.action,
    outcome: 'success',
    actor_id: event.user_id,
    actor_type: 'user',
    target_type: 'integration_credential',
    target_id: event.integration_id,
    timestamp: event.timestamp,
    details: {
      integration_type: event.integration_type,
      operation: event.operation,
      ip_address: event.ip_address,
    },
  });
}
```

### Token Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **Short-lived tokens** | GitHub App tokens expire in 1 hour |
| **No PATs stored** | Use App installation tokens, not user PATs |
| **Token rotation** | Refresh tokens rotated on use |
| **Minimal scopes** | Request only needed permissions |
| **Revocation support** | Disconnect immediately revokes access |

---

## Data Model

### Base Integration Framework

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Integration Data Model                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────┐                                          │
│  │  integration_types    │  (Code-defined registry)                 │
│  │  ─────────────────    │                                          │
│  │  type: github         │                                          │
│  │  type: slack          │                                          │
│  │  type: discord        │                                          │
│  └───────────────────────┘                                          │
│              │                                                       │
│              ▼                                                       │
│  ┌───────────────────────┐        ┌──────────────────────────────┐ │
│  │  team_integrations    │        │  integration_credentials     │ │
│  │  ─────────────────    │───────▶│  ────────────────────────    │ │
│  │  integration_id (PK)  │        │  integration_id (PK/FK)      │ │
│  │  team_id (FK)         │        │  encrypted_data              │ │
│  │  type                 │        │  key_version                 │ │
│  │  status               │        │  created_at                  │ │
│  │  external_id          │        │  rotated_at                  │ │
│  │  external_name        │        └──────────────────────────────┘ │
│  │  config (JSON)        │                                          │
│  │  last_sync_at         │                                          │
│  └───────────┬───────────┘                                          │
│              │                                                       │
│              │ Provider-specific data tables                         │
│              │                                                       │
│    ┌─────────┴─────────┬────────────────────┐                       │
│    ▼                   ▼                    ▼                       │
│  ┌────────────┐  ┌────────────┐   ┌─────────────────┐              │
│  │ github_    │  │ github_    │   │ slack_channels  │              │
│  │ repositories│  │ members   │   │ (future)        │              │
│  └────────────┘  └────────────┘   └─────────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Entity Relationships

```
Team (existing)
  └── TeamIntegration (1:many - one per type for MVP)
        ├── IntegrationCredential (1:1, encrypted)
        └── Provider-specific data:
              ├── GitHubRepository (1:many)
              ├── GitHubMember (1:many)
              ├── SlackChannel (1:many, future)
              └── etc.
```

---

## Shared Types

### File: `shared/src/types/integration.ts`

```typescript
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
  external_id: string;           // e.g., GitHub installation_id
  external_account_id?: string;  // e.g., GitHub org_id
  external_account_name: string; // e.g., GitHub org login
  external_account_avatar?: string;
  
  // Connection metadata
  connected_by_user_id: string;
  connected_by_external_id?: string;  // e.g., GitHub user who installed
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
```

### Update: `shared/src/index.ts`

```typescript
// ... existing exports ...
export * from './types/integration';
```

---

## Backend Services

### Integration Service Interface

```typescript
// server/src/services/integrations/types.ts

import type {
  IntegrationType,
  IntegrationDefinition,
  TeamIntegration,
  SyncResponse,
} from '@machina/shared';

/**
 * Context for integration operations
 */
export interface IntegrationContext {
  teamId: string;
  userId: string;
  userRole: 'admin' | 'member';
  ipAddress?: string;
}

/**
 * Abstract interface all integration services must implement
 */
export interface IntegrationService {
  /** The integration type this service handles */
  readonly type: IntegrationType;
  
  /** Integration metadata */
  readonly definition: IntegrationDefinition;
  
  // ============ Connection Lifecycle ============
  
  /**
   * Generate the OAuth/install URL for connecting
   */
  getConnectUrl(ctx: IntegrationContext): Promise<string>;
  
  /**
   * Handle the OAuth callback after user authorizes
   * Returns the created integration
   */
  handleCallback(
    ctx: IntegrationContext, 
    params: Record<string, string>
  ): Promise<TeamIntegration>;
  
  /**
   * Disconnect and cleanup
   */
  disconnect(ctx: IntegrationContext, integrationId: string): Promise<void>;
  
  // ============ Sync Operations ============
  
  /**
   * Trigger a sync operation
   */
  sync(ctx: IntegrationContext, integrationId: string): Promise<SyncResponse>;
  
  /**
   * Get current sync status
   */
  getSyncStatus(integrationId: string): Promise<{
    status: 'idle' | 'in_progress';
    progress?: number;
    last_sync_at?: string;
  }>;
  
  // ============ Validation ============
  
  /**
   * Verify the integration is still valid (token works, etc.)
   */
  verify(ctx: IntegrationContext, integrationId: string): Promise<boolean>;
}
```

### Integration Service Registry

```typescript
// server/src/services/integrations/registry.ts

import type { IntegrationType, IntegrationDefinition } from '@machina/shared';
import type { IntegrationService } from './types';
import { GitHubIntegrationService } from './github';
// import { SlackIntegrationService } from './slack';  // Future

/**
 * Registry of all supported integrations
 */
export const INTEGRATION_DEFINITIONS: Record<IntegrationType, IntegrationDefinition> = {
  github: {
    type: 'github',
    name: 'GitHub',
    description: 'Connect your GitHub organization to import repositories and members',
    icon: 'github',
    available: true,
    docsUrl: 'https://docs.example.com/integrations/github',
    features: ['repositories', 'members', 'activity'],
    requiredScopes: ['read:org', 'repo'],
  },
  slack: {
    type: 'slack',
    name: 'Slack',
    description: 'Connect Slack workspace for notifications and commands',
    icon: 'slack',
    available: false, // Coming soon
    features: ['notifications', 'commands'],
    requiredScopes: ['channels:read', 'chat:write'],
  },
  discord: {
    type: 'discord',
    name: 'Discord',
    description: 'Connect Discord server for notifications',
    icon: 'discord',
    available: false,
    features: ['notifications'],
    requiredScopes: ['bot'],
  },
  x: {
    type: 'x',
    name: 'X (Twitter)',
    description: 'Connect X account for social tracking',
    icon: 'twitter',
    available: false,
    features: ['posts', 'mentions'],
    requiredScopes: ['tweet.read', 'users.read'],
  },
};

/**
 * Service instances (singleton per type)
 */
const services: Map<IntegrationType, IntegrationService> = new Map();

/**
 * Get the service for an integration type
 */
export function getIntegrationService(type: IntegrationType): IntegrationService {
  let service = services.get(type);
  
  if (!service) {
    switch (type) {
      case 'github':
        service = new GitHubIntegrationService();
        break;
      // case 'slack':
      //   service = new SlackIntegrationService();
      //   break;
      default:
        throw new Error(`Integration type '${type}' is not implemented`);
    }
    services.set(type, service);
  }
  
  return service;
}

/**
 * Get all available integrations
 */
export function getAvailableIntegrations(): IntegrationDefinition[] {
  return Object.values(INTEGRATION_DEFINITIONS).filter(d => d.available);
}

/**
 * Check if an integration type is supported
 */
export function isIntegrationSupported(type: string): type is IntegrationType {
  return type in INTEGRATION_DEFINITIONS;
}
```

### GitHub Service Implementation

```typescript
// server/src/services/integrations/github.ts

import { App, Octokit } from 'octokit';
import { v4 as uuidv4 } from 'uuid';
import type {
  IntegrationType,
  IntegrationDefinition,
  TeamIntegration,
  GitHubRepository,
  GitHubMember,
  SyncResponse,
} from '@machina/shared';
import type { IntegrationService, IntegrationContext } from './types';
import { INTEGRATION_DEFINITIONS } from './registry';
import { database } from '../database';
import { 
  encryptCredentials, 
  decryptCredentials,
  generateOAuthState,
  validateOAuthState,
} from '../credentialVault';

export class GitHubIntegrationService implements IntegrationService {
  readonly type: IntegrationType = 'github';
  readonly definition: IntegrationDefinition = INTEGRATION_DEFINITIONS.github;
  
  private app: App;
  
  constructor() {
    this.app = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    });
  }
  
  async getConnectUrl(ctx: IntegrationContext): Promise<string> {
    // Check if already connected
    const existing = database.getTeamIntegration(ctx.teamId, 'github');
    if (existing && existing.status === 'active') {
      throw new Error('GitHub is already connected');
    }
    
    // Generate secure state
    const state = generateOAuthState(ctx.teamId, ctx.userId);
    
    // Store state for validation (TTL: 10 minutes)
    database.storeOAuthState(state, ctx.teamId, ctx.userId, 10);
    
    const appSlug = process.env.GITHUB_APP_SLUG!;
    return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;
  }
  
  async handleCallback(
    ctx: IntegrationContext,
    params: Record<string, string>
  ): Promise<TeamIntegration> {
    const { installation_id, setup_action, state } = params;
    
    // Validate state
    const stateData = validateOAuthState(state);
    if (!stateData || stateData.teamId !== ctx.teamId) {
      throw new Error('Invalid or expired OAuth state');
    }
    
    // Clean up state
    database.deleteOAuthState(state);
    
    if (setup_action === 'install') {
      // Get installation details from GitHub
      const octokit = await this.app.getInstallationOctokit(parseInt(installation_id));
      const { data: installation } = await octokit.rest.apps.getInstallation({
        installation_id: parseInt(installation_id),
      });
      
      const account = installation.account!;
      const integrationId = `int_${uuidv4().substring(0, 20)}`;
      const now = new Date().toISOString();
      
      // Create integration record
      const integration: TeamIntegration = {
        integration_id: integrationId,
        team_id: ctx.teamId,
        type: 'github',
        status: 'active',
        external_id: installation_id,
        external_account_id: String(account.id),
        external_account_name: account.login!,
        external_account_avatar: account.avatar_url,
        connected_by_user_id: ctx.userId,
        connected_by_external_id: String(installation.account?.id),
        config: {
          repo_selection: installation.repository_selection,
        },
        created_at: now,
        updated_at: now,
      };
      
      // Store integration
      database.insertTeamIntegration(integration);
      
      // Store credentials (installation ID is the "credential" for GitHub Apps)
      // We store it encrypted even though it's not super sensitive
      // because we want consistent handling
      encryptAndStoreCredentials(ctx.teamId, integrationId, {
        installation_id: parseInt(installation_id),
      });
      
      // Log audit event
      database.insertAuditEvent({
        event_id: `evt_${uuidv4()}`,
        action: 'integration.connected',
        outcome: 'success',
        actor_id: ctx.userId,
        actor_type: 'user',
        target_type: 'integration',
        target_id: integrationId,
        target_name: `github:${account.login}`,
        timestamp: now,
        details: {
          integration_type: 'github',
          external_account: account.login,
        },
      });
      
      // Trigger initial sync (async)
      this.sync(ctx, integrationId).catch(err => {
        console.error('Initial sync failed:', err);
      });
      
      return integration;
    }
    
    throw new Error(`Unexpected setup_action: ${setup_action}`);
  }
  
  async disconnect(ctx: IntegrationContext, integrationId: string): Promise<void> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration || integration.team_id !== ctx.teamId) {
      throw new Error('Integration not found');
    }
    
    // Mark as disconnected (soft delete)
    database.updateTeamIntegration({
      integration_id: integrationId,
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    });
    
    // Delete credentials
    database.deleteIntegrationCredentials(integrationId);
    
    // Mark all synced data as removed
    database.markAllGitHubDataRemoved(integrationId);
    
    // Log audit event
    database.insertAuditEvent({
      event_id: `evt_${uuidv4()}`,
      action: 'integration.disconnected',
      outcome: 'success',
      actor_id: ctx.userId,
      actor_type: 'user',
      target_type: 'integration',
      target_id: integrationId,
      target_name: `github:${integration.external_account_name}`,
      timestamp: new Date().toISOString(),
    });
  }
  
  async sync(ctx: IntegrationContext, integrationId: string): Promise<SyncResponse> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration || integration.team_id !== ctx.teamId) {
      throw new Error('Integration not found');
    }
    
    const startedAt = new Date().toISOString();
    
    // Mark sync in progress
    database.updateTeamIntegration({
      integration_id: integrationId,
      last_sync_status: 'in_progress',
      updated_at: startedAt,
    });
    
    try {
      // Get credentials
      const creds = decryptAndGetCredentials(ctx.teamId, integrationId);
      const octokit = await this.app.getInstallationOctokit(creds.installation_id);
      
      // Sync repositories
      const repos = await this.syncRepositories(octokit, integration);
      
      // Sync members
      const members = await this.syncMembers(octokit, integration);
      
      // Update integration
      database.updateTeamIntegration({
        integration_id: integrationId,
        last_sync_at: startedAt,
        last_sync_status: 'success',
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      });
      
      // Log audit
      database.insertAuditEvent({
        event_id: `evt_${uuidv4()}`,
        action: 'integration.synced',
        outcome: 'success',
        actor_id: ctx.userId,
        actor_type: 'user',
        target_type: 'integration',
        target_id: integrationId,
        timestamp: new Date().toISOString(),
        details: {
          repos_synced: repos,
          members_synced: members,
        },
      });
      
      return {
        success: true,
        started_at: startedAt,
        items_synced: repos + members,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      database.updateTeamIntegration({
        integration_id: integrationId,
        last_sync_at: startedAt,
        last_sync_status: 'error',
        last_sync_error: message,
        updated_at: new Date().toISOString(),
      });
      
      throw error;
    }
  }
  
  private async syncRepositories(
    octokit: Octokit, 
    integration: TeamIntegration
  ): Promise<number> {
    const repos = await octokit.paginate(
      octokit.rest.apps.listReposAccessibleToInstallation,
      { per_page: 100 }
    );
    
    const activeIds: number[] = [];
    const now = new Date().toISOString();
    
    for (const repo of repos) {
      activeIds.push(repo.id);
      
      database.upsertGitHubRepository({
        repo_id: `ghr_${repo.id}`,
        team_id: integration.team_id,
        integration_id: integration.integration_id,
        github_repo_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || undefined,
        private: repo.private,
        archived: repo.archived || false,
        disabled: repo.disabled || false,
        default_branch: repo.default_branch || 'main',
        html_url: repo.html_url,
        language: repo.language || undefined,
        stargazers_count: repo.stargazers_count || 0,
        forks_count: repo.forks_count || 0,
        open_issues_count: repo.open_issues_count || 0,
        pushed_at: repo.pushed_at || undefined,
        sync_status: 'ok',
        last_error: undefined,
        imported_at: now,
        updated_at: now,
      });
    }
    
    // Mark removed repos
    database.markRemovedGitHubRepositories(integration.integration_id, activeIds);
    
    return repos.length;
  }
  
  private async syncMembers(
    octokit: Octokit,
    integration: TeamIntegration
  ): Promise<number> {
    const members = await octokit.paginate(
      octokit.rest.orgs.listMembers,
      { org: integration.external_account_name, per_page: 100 }
    );
    
    const activeIds: number[] = [];
    const now = new Date().toISOString();
    
    for (const member of members) {
      activeIds.push(member.id);
      
      // Get member role
      let role: 'admin' | 'member' = 'member';
      try {
        const { data: membership } = await octokit.rest.orgs.getMembershipForUser({
          org: integration.external_account_name,
          username: member.login,
        });
        role = membership.role as 'admin' | 'member';
      } catch {
        // Default to member if we can't get role
      }
      
      database.upsertGitHubMember({
        member_id: `ghm_${member.id}`,
        team_id: integration.team_id,
        integration_id: integration.integration_id,
        github_user_id: member.id,
        login: member.login,
        avatar_url: member.avatar_url,
        html_url: member.html_url,
        role,
        sync_status: 'ok',
        last_error: undefined,
        imported_at: now,
        updated_at: now,
      });
    }
    
    // Mark removed members
    database.markRemovedGitHubMembers(integration.integration_id, activeIds);
    
    return members.length;
  }
  
  async getSyncStatus(integrationId: string): Promise<{
    status: 'idle' | 'in_progress';
    progress?: number;
    last_sync_at?: string;
  }> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }
    
    return {
      status: integration.last_sync_status === 'in_progress' ? 'in_progress' : 'idle',
      last_sync_at: integration.last_sync_at,
    };
  }
  
  async verify(ctx: IntegrationContext, integrationId: string): Promise<boolean> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration || integration.team_id !== ctx.teamId) {
      return false;
    }
    
    try {
      const creds = decryptAndGetCredentials(ctx.teamId, integrationId);
      const octokit = await this.app.getInstallationOctokit(creds.installation_id);
      
      // Try to get installation info
      await octokit.rest.apps.getInstallation({
        installation_id: creds.installation_id,
      });
      
      return true;
    } catch {
      return false;
    }
  }
}

// Helper functions for credential management
function encryptAndStoreCredentials(
  teamId: string,
  integrationId: string,
  credentials: Record<string, unknown>
): void {
  const encrypted = encryptCredentials(teamId, integrationId, credentials);
  database.storeIntegrationCredentials(integrationId, encrypted);
}

function decryptAndGetCredentials(
  teamId: string,
  integrationId: string
): { installation_id: number } {
  const encrypted = database.getIntegrationCredentials(integrationId);
  if (!encrypted) {
    throw new Error('Credentials not found');
  }
  return decryptCredentials(teamId, integrationId, encrypted) as { installation_id: number };
}
```

---

## Backend API

### Unified Integration Router

```typescript
// server/src/routes/integrations.ts

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { ApiResponse, IntegrationType, IntegrationStatusResponse } from '@machina/shared';
import { AppError } from '../middleware/errorHandler';
import { requireTeamAdmin } from '../middleware/auth';
import { 
  getIntegrationService, 
  getAvailableIntegrations,
  isIntegrationSupported,
  INTEGRATION_DEFINITIONS,
} from '../services/integrations/registry';
import { database } from '../services/database';

export const integrationsRouter = Router();

// ============ Generic Endpoints ============

// GET /integrations - List all available integrations
integrationsRouter.get('/', (req: Request, res: Response) => {
  const teamId = req.teamId!;
  
  // Get all integration definitions
  const definitions = Object.values(INTEGRATION_DEFINITIONS);
  
  // Get team's active integrations
  const activeIntegrations = database.getTeamIntegrations(teamId);
  const activeTypes = new Set(activeIntegrations.map(i => i.type));
  
  const integrations = definitions.map(def => ({
    ...def,
    connected: activeTypes.has(def.type),
  }));
  
  const response: ApiResponse<typeof integrations> = {
    success: true,
    data: integrations,
  };
  
  res.json(response);
});

// ============ Type-Specific Endpoints ============

// Middleware to validate integration type
function validateIntegrationType(req: Request, _res: Response, next: NextFunction) {
  const { type } = req.params;
  
  if (!isIntegrationSupported(type)) {
    return next(new AppError(400, 'INVALID_TYPE', `Unknown integration type: ${type}`));
  }
  
  const definition = INTEGRATION_DEFINITIONS[type as IntegrationType];
  if (!definition.available) {
    return next(new AppError(400, 'NOT_AVAILABLE', `Integration '${type}' is not yet available`));
  }
  
  next();
}

// GET /integrations/:type/status - Get integration status
integrationsRouter.get(
  '/:type/status',
  validateIntegrationType,
  (req: Request, res: Response) => {
    const { type } = req.params as { type: IntegrationType };
    const teamId = req.teamId!;
    
    const service = getIntegrationService(type);
    const integration = database.getTeamIntegration(teamId, type);
    
    let stats: Record<string, number> | undefined;
    if (integration) {
      stats = database.getIntegrationStats(integration.integration_id);
    }
    
    const response: ApiResponse<IntegrationStatusResponse> = {
      success: true,
      data: {
        connected: !!integration && integration.status === 'active',
        integration: integration || undefined,
        stats,
        definition: service.definition,
      },
    };
    
    res.json(response);
  }
);

// GET /integrations/:type/connect/start - Start OAuth flow
integrationsRouter.get(
  '/:type/connect/start',
  validateIntegrationType,
  requireTeamAdmin, // Only admins can connect
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const service = getIntegrationService(type);
      
      const url = await service.getConnectUrl({
        teamId: req.teamId!,
        userId: req.user!.user_id,
        userRole: req.teamRole!,
        ipAddress: req.ip,
      });
      
      const response: ApiResponse<{ url: string }> = {
        success: true,
        data: { url },
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /integrations/:type/connect/callback - Handle OAuth callback
integrationsRouter.get(
  '/:type/connect/callback',
  validateIntegrationType,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const service = getIntegrationService(type);
      
      // Note: Callback may not have auth context, we validate via state
      const integration = await service.handleCallback(
        {
          teamId: req.teamId || '', // Will be validated from state
          userId: req.user?.user_id || '',
          userRole: 'admin',
          ipAddress: req.ip,
        },
        req.query as Record<string, string>
      );
      
      // Redirect to integrations page
      res.redirect(`/integrations?connected=${type}`);
    } catch (error) {
      // Redirect with error
      const message = error instanceof Error ? error.message : 'Connection failed';
      res.redirect(`/integrations?error=${encodeURIComponent(message)}`);
    }
  }
);

// POST /integrations/:type/sync - Trigger sync
integrationsRouter.post(
  '/:type/sync',
  validateIntegrationType,
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId!;
      
      const integration = database.getTeamIntegration(teamId, type);
      if (!integration) {
        throw new AppError(404, 'NOT_CONNECTED', `${type} is not connected`);
      }
      
      const service = getIntegrationService(type);
      const result = await service.sync(
        {
          teamId,
          userId: req.user!.user_id,
          userRole: req.teamRole!,
          ipAddress: req.ip,
        },
        integration.integration_id
      );
      
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /integrations/:type - Disconnect
integrationsRouter.delete(
  '/:type',
  validateIntegrationType,
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId!;
      
      const integration = database.getTeamIntegration(teamId, type);
      if (!integration) {
        throw new AppError(404, 'NOT_CONNECTED', `${type} is not connected`);
      }
      
      const service = getIntegrationService(type);
      await service.disconnect(
        {
          teamId,
          userId: req.user!.user_id,
          userRole: req.teamRole!,
          ipAddress: req.ip,
        },
        integration.integration_id
      );
      
      const response: ApiResponse<{ disconnected: boolean }> = {
        success: true,
        data: { disconnected: true },
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ============ GitHub-Specific Data Endpoints ============

// GET /integrations/github/repos - List repositories
integrationsRouter.get('/github/repos', (req: Request, res: Response) => {
  const teamId = req.teamId!;
  const { search, visibility, archived, sync_status } = req.query;
  
  const repos = database.getGitHubRepositories(teamId, {
    search: search as string,
    visibility: visibility as 'public' | 'private' | 'all',
    archived: archived === 'true',
    sync_status: sync_status as any,
  });
  
  const response: ApiResponse<typeof repos> = {
    success: true,
    data: repos,
  };
  
  res.json(response);
});

// GET /integrations/github/repos/:id
integrationsRouter.get('/github/repos/:id', (req: Request, res: Response) => {
  const teamId = req.teamId!;
  const { id } = req.params;
  
  const repo = database.getGitHubRepository(id, teamId);
  if (!repo) {
    throw new AppError(404, 'NOT_FOUND', 'Repository not found');
  }
  
  const response: ApiResponse<typeof repo> = {
    success: true,
    data: repo,
  };
  
  res.json(response);
});

// GET /integrations/github/members - List members
integrationsRouter.get('/github/members', (req: Request, res: Response) => {
  const teamId = req.teamId!;
  const { search, role, sync_status } = req.query;
  
  const members = database.getGitHubMembers(teamId, {
    search: search as string,
    role: role as 'admin' | 'member',
    sync_status: sync_status as any,
  });
  
  const response: ApiResponse<typeof members> = {
    success: true,
    data: members,
  };
  
  res.json(response);
});

// GET /integrations/github/members/:id
integrationsRouter.get('/github/members/:id', (req: Request, res: Response) => {
  const teamId = req.teamId!;
  const { id } = req.params;
  
  const member = database.getGitHubMember(id, teamId);
  if (!member) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found');
  }
  
  const response: ApiResponse<typeof member> = {
    success: true,
    data: member,
  };
  
  res.json(response);
});
```

### Register Router

Update `server/src/index.ts`:

```typescript
import { integrationsRouter } from './routes/integrations';

// Add with other protected routes
app.use('/api/integrations', requireAuth, requireTeamContext, integrationsRouter);
```

---

## Database Schema

### Add to `server/src/services/database.ts`

```sql
-- ============ Integration Framework Tables ============

-- Team Integrations (base table for all integrations)
CREATE TABLE IF NOT EXISTS team_integrations (
  integration_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  
  -- External provider identity
  external_id TEXT NOT NULL,
  external_account_id TEXT,
  external_account_name TEXT NOT NULL,
  external_account_avatar TEXT,
  
  -- Connection metadata
  connected_by_user_id TEXT NOT NULL,
  connected_by_external_id TEXT,
  connected_by_external_name TEXT,
  
  -- Sync state  
  last_sync_at TEXT,
  last_sync_status TEXT,
  last_sync_error TEXT,
  next_sync_at TEXT,
  
  -- Provider-specific config (JSON, non-sensitive)
  config TEXT,
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (connected_by_user_id) REFERENCES users(user_id),
  UNIQUE(team_id, type)  -- One integration per type per team (MVP)
);

-- Integration Credentials (encrypted, separate table)
CREATE TABLE IF NOT EXISTS integration_credentials (
  integration_id TEXT PRIMARY KEY,
  encrypted_data TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  rotated_at TEXT,
  FOREIGN KEY (integration_id) REFERENCES team_integrations(integration_id) ON DELETE CASCADE
);

-- OAuth State (temporary, for CSRF protection)
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- ============ GitHub-Specific Tables ============

-- GitHub Repositories
CREATE TABLE IF NOT EXISTS github_repositories (
  repo_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  github_repo_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  private INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  default_branch TEXT NOT NULL DEFAULT 'main',
  html_url TEXT NOT NULL,
  language TEXT,
  stargazers_count INTEGER DEFAULT 0,
  forks_count INTEGER DEFAULT 0,
  open_issues_count INTEGER DEFAULT 0,
  pushed_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'ok',
  last_error TEXT,
  imported_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (integration_id) REFERENCES team_integrations(integration_id) ON DELETE CASCADE,
  UNIQUE(integration_id, github_repo_id)
);

-- GitHub Members
CREATE TABLE IF NOT EXISTS github_members (
  member_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  github_user_id INTEGER NOT NULL,
  login TEXT NOT NULL,
  avatar_url TEXT,
  html_url TEXT NOT NULL,
  role TEXT,
  sync_status TEXT NOT NULL DEFAULT 'ok',
  last_error TEXT,
  imported_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (integration_id) REFERENCES team_integrations(integration_id) ON DELETE CASCADE,
  UNIQUE(integration_id, github_user_id)
);

-- ============ Indexes ============

CREATE INDEX IF NOT EXISTS idx_team_integrations_team ON team_integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_integrations_type ON team_integrations(type);
CREATE INDEX IF NOT EXISTS idx_team_integrations_status ON team_integrations(status);

CREATE INDEX IF NOT EXISTS idx_github_repos_team ON github_repositories(team_id);
CREATE INDEX IF NOT EXISTS idx_github_repos_integration ON github_repositories(integration_id);
CREATE INDEX IF NOT EXISTS idx_github_repos_sync ON github_repositories(sync_status);

CREATE INDEX IF NOT EXISTS idx_github_members_team ON github_members(team_id);
CREATE INDEX IF NOT EXISTS idx_github_members_integration ON github_members(integration_id);
CREATE INDEX IF NOT EXISTS idx_github_members_sync ON github_members(sync_status);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
```

---

## Frontend Components

### File Structure

```
client/src/apps/integrations/
├── index.ts
├── IntegrationsApp.tsx
├── IntegrationsApp.module.css
├── components/
│   ├── index.ts
│   ├── IntegrationCard/
│   │   ├── index.ts
│   │   ├── IntegrationCard.tsx
│   │   └── IntegrationCard.module.css
│   ├── GitHubOverview/
│   │   ├── index.ts
│   │   ├── GitHubOverview.tsx
│   │   └── GitHubOverview.module.css
│   ├── GitHubRepoList/
│   │   ├── index.ts
│   │   ├── GitHubRepoList.tsx
│   │   └── GitHubRepoList.module.css
│   ├── GitHubMemberList/
│   │   ├── index.ts
│   │   ├── GitHubMemberList.tsx
│   │   └── GitHubMemberList.module.css
│   └── DisconnectModal/
│       ├── index.ts
│       ├── DisconnectModal.tsx
│       └── DisconnectModal.module.css
└── hooks/
    ├── index.ts
    └── useIntegration.ts
```

*Frontend implementation remains similar to original spec but uses the new unified API structure.*

---

## Implementation Checklist

### Phase 1: Core Framework

- [ ] Create `shared/src/types/integration.ts`
- [ ] Update `shared/src/index.ts`
- [ ] Create `server/src/services/credentialVault.ts` with per-team encryption
- [ ] Create `server/src/services/integrations/types.ts`
- [ ] Create `server/src/services/integrations/registry.ts`
- [ ] Add database tables to `server/src/services/database.ts`
- [ ] Add database operations for integrations

### Phase 2: GitHub Implementation

- [ ] Create GitHub App on GitHub
- [ ] Create `server/src/services/integrations/github.ts`
- [ ] Create `server/src/routes/integrations.ts`
- [ ] Register router in `server/src/index.ts`
- [ ] Test connection flow end-to-end

### Phase 3: Frontend

- [ ] Create `client/src/apps/integrations/` folder structure
- [ ] Implement `IntegrationsApp.tsx`
- [ ] Implement GitHub-specific components
- [ ] Add API functions to `client/src/lib/api.ts`
- [ ] Add route to `App.tsx` and nav to `Appbar.tsx`

### Phase 4: Security Hardening

- [ ] Implement OAuth state validation
- [ ] Add comprehensive audit logging
- [ ] Add rate limiting to sensitive endpoints
- [ ] Write security tests

### Phase 5: Polish

- [ ] Add constants to `client/src/shared/constants/`
- [ ] Add Sidekick views (optional)
- [ ] Write E2E tests
- [ ] Documentation

---

## Security Checklist

- [ ] Per-team key derivation implemented
- [ ] AAD binding on all encrypted data
- [ ] OAuth state uses HMAC + expiry
- [ ] All credential access is audit logged
- [ ] Team ID validated on every request
- [ ] Admin role required for connect/disconnect/sync
- [ ] No long-lived tokens stored
- [ ] Rate limiting on connect/sync endpoints
- [ ] Credentials deleted on disconnect
- [ ] Input validation on all endpoints
