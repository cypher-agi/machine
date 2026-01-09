# SPEC-01: Machina Base System

> **Version:** 1.0  
> **Status:** Current Implementation  
> **Last Updated:** January 2026

## 1. Overview

**Machina** is a modern web application for provisioning and managing compute infrastructure across multiple cloud providers using Terraform as the deployment engine. The system provides a unified interface for teams to manage machines, deployments, and integrations.

### 1.1 Core Value Proposition

- **Multi-Provider Support**: Deploy to DigitalOcean, AWS, GCP, Hetzner, and bare metal
- **Terraform-Powered**: All infrastructure changes tracked as Terraform runs
- **Team-Based Organization**: Resources scoped to teams with role-based access
- **Real-time Updates**: Live deployment logs via Server-Sent Events
- **Machine Inspector**: Deep insights into machine status, networking, and services
- **Bootstrap Profiles**: Pre-configured setups for services
- **Integration Framework**: Connect external services (GitHub, Slack, Discord)

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React)                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Machines │ │Providers│ │  Keys   │ │ Deploy  │ │  Teams  │   │
│  │   App   │ │   App   │ │   App   │ │   App   │ │   App   │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │           │         │
│  ┌────┴───────────┴───────────┴───────────┴───────────┴────┐   │
│  │                    API Client (lib/api)                  │   │
│  └──────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ REST + SSE
┌─────────────────────────────┼───────────────────────────────────┐
│                      Server (Express)                           │
│  ┌──────────────────────────┴──────────────────────────────┐   │
│  │                      Routes Layer                        │   │
│  │  machines│providers│deployments│teams│auth│integrations │   │
│  └────┬─────────┬─────────┬─────────┬─────────┬────────────┘   │
│       │         │         │         │         │                 │
│  ┌────┴─────────┴─────────┴─────────┴─────────┴────────────┐   │
│  │                    Services Layer                        │   │
│  │  database│terraform│credentialVault│machineOps│repoSync │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┴──────────────────────────────┐  │
│  │                   Data/External Layer                     │  │
│  │           SQLite │ Terraform CLI │ Provider APIs          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Directory Structure

```
machina/
├── client/          # React + TypeScript frontend (Vite)
│   └── src/
│       ├── app/           # App-level concerns (layouts, routing)
│       ├── apps/          # Page-level applications
│       ├── features/      # Feature modules (sidekick, terminal, profile)
│       ├── shared/        # Shared resources (components, ui, lib)
│       ├── lib/           # API client
│       └── store/         # Zustand state management
│
├── server/          # Node.js + Express backend
│   └── src/
│       ├── routes/        # Express route handlers
│       ├── services/      # Business logic
│       ├── middleware/    # Auth, error handling
│       └── terraform/     # Terraform modules
│
├── shared/          # Shared TypeScript types
│   └── src/types/         # Type definitions
│
├── docs/            # Feature specifications
├── spec/            # System specifications
└── e2e/             # Playwright E2E tests
```

---

## 3. Data Model

### 3.1 Core Entities

#### User
The authenticated user account.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | Unique identifier |
| `email` | string | User's email address |
| `display_name` | string | Display name |
| `profile_picture_url` | string? | Avatar URL |
| `role` | `admin` \| `user` \| `readonly` | System-wide role |
| `created_at` | timestamp | Account creation time |
| `last_login_at` | timestamp? | Last login time |

#### Team
Organization unit that owns resources.

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | string | Unique identifier |
| `name` | string | Display name |
| `handle` | string | Unique handle (like @username) |
| `avatar_url` | string? | Team avatar |
| `created_by` | string | Creator's user_id |

#### TeamMember
Associates users with teams.

| Field | Type | Description |
|-------|------|-------------|
| `team_member_id` | string | Unique identifier |
| `team_id` | string | Team reference |
| `user_id` | string | User reference |
| `role` | `admin` \| `member` | Role within team |
| `joined_at` | timestamp | When user joined |
| `invited_by` | string? | Inviter's user_id |

### 3.2 Infrastructure Entities

#### Machine
Core compute instance model.

| Field | Type | Description |
|-------|------|-------------|
| `machine_id` | string | Unique identifier |
| `team_id` | string | Owning team |
| `name` | string | Machine name |
| `provider` | ProviderType | Cloud provider |
| `provider_account_id` | string | Provider credentials |
| `region` | string | Deployment region |
| `zone` | string? | Availability zone |
| `size` | string | Instance size |
| `image` | string | OS image |
| `desired_status` | MachineStatus | Target state |
| `actual_status` | MachineStatus | Current state |
| `public_ip` | string? | Public IPv4 |
| `private_ip` | string? | Private IPv4 |
| `terraform_workspace` | string | TF workspace name |
| `terraform_state_status` | TerraformStateStatus | Sync status |
| `provisioning_method` | ProvisioningMethod | How provisioned |
| `agent_status` | AgentStatus | Machina agent status |
| `provider_resource_id` | string? | Provider's instance ID |

**MachineStatus Values:**
- `pending` - Awaiting provisioning
- `provisioning` - Being created
- `running` - Active and healthy
- `stopping` - Being stopped
- `stopped` - Powered off
- `rebooting` - Restart in progress
- `terminating` - Being destroyed
- `terminated` - Destroyed
- `error` - Failed state

**ProviderType Values:**
- `digitalocean`
- `aws`
- `gcp`
- `hetzner`
- `baremetal`

#### ProviderAccount
Stored cloud provider credentials.

| Field | Type | Description |
|-------|------|-------------|
| `provider_account_id` | string | Unique identifier |
| `team_id` | string | Owning team |
| `provider_type` | ProviderType | Provider type |
| `label` | string | Display name |
| `credential_status` | CredentialStatus | Validity status |
| `scopes` | string[]? | Granted permissions |
| `last_verified_at` | timestamp? | Last verification |

**Credential Types per Provider:**
- **DigitalOcean**: `api_token`
- **AWS**: `access_key_id`, `secret_access_key`, `region?`, `assume_role_arn?`
- **GCP**: `project_id`, `service_account_json`
- **Hetzner**: `api_token`

#### Deployment
Terraform operation tracking.

| Field | Type | Description |
|-------|------|-------------|
| `deployment_id` | string | Unique identifier |
| `team_id` | string | Owning team |
| `machine_id` | string? | Target machine |
| `type` | DeploymentType | Operation type |
| `state` | DeploymentState | Current state |
| `terraform_workspace` | string | TF workspace |
| `plan_summary` | TerraformPlanSummary? | Plan details |
| `initiated_by` | string | Actor |
| `error_message` | string? | Error details |

**DeploymentType Values:**
- `create` - New machine
- `update` - Modify existing
- `destroy` - Remove machine
- `reboot` - Restart machine
- `restart_service` - Service restart
- `refresh` - State refresh

**DeploymentState Values:**
- `queued` - Waiting to start
- `planning` - Running terraform plan
- `awaiting_approval` - Plan needs approval
- `applying` - Running terraform apply
- `succeeded` - Completed successfully
- `failed` - Error occurred
- `cancelled` - Manually cancelled

### 3.3 Configuration Entities

#### SSHKey
SSH key management.

| Field | Type | Description |
|-------|------|-------------|
| `ssh_key_id` | string | Unique identifier |
| `team_id` | string | Owning team |
| `name` | string | Key name |
| `fingerprint` | string | Key fingerprint |
| `public_key` | string | Public key content |
| `provider_key_ids` | Record<string, string> | Provider-synced IDs |
| `key_type` | SSHKeyType | Algorithm type |
| `key_bits` | number | Key length |

**SSHKeyType Values:** `ed25519`, `rsa`, `ecdsa`

#### BootstrapProfile
Machine boot-time configuration.

| Field | Type | Description |
|-------|------|-------------|
| `profile_id` | string | Unique identifier |
| `team_id` | string? | Owning team (null = system) |
| `name` | string | Profile name |
| `method` | BootstrapMethod | Bootstrap approach |
| `cloud_init_template` | string? | Cloud-init script |
| `ssh_bootstrap_script` | string? | SSH script |
| `ansible_playbook_ref` | string? | Ansible reference |
| `services_to_run` | ServiceConfig[] | Services to install |
| `config_schema` | ConfigVariable[]? | Configuration vars |
| `is_system_profile` | boolean | Read-only system profile |

**BootstrapMethod Values:** `cloud_init`, `ssh_script`, `ansible`

#### FirewallProfile
Network security rules.

| Field | Type | Description |
|-------|------|-------------|
| `profile_id` | string | Unique identifier |
| `name` | string | Profile name |
| `rules` | FirewallRule[] | Security rules |

### 3.4 Integration Entities

#### TeamIntegration
Connection to external services.

| Field | Type | Description |
|-------|------|-------------|
| `integration_id` | string | Unique identifier |
| `team_id` | string | Owning team |
| `type` | IntegrationType | Integration type |
| `status` | IntegrationStatus | Connection status |
| `external_id` | string | Provider's ID (e.g., installation_id) |
| `external_account_name` | string | Account display name |
| `connected_by_user_id` | string | User who connected |
| `last_sync_at` | timestamp? | Last data sync |
| `config` | Record<string, unknown>? | Provider-specific config |

**IntegrationType Values:** `github`, `slack`, `discord`, `x`

**IntegrationStatus Values:** `active`, `suspended`, `error`, `disconnected`

### 3.5 Repository Entities

#### Repository
Tracked source code repository (provider-agnostic).

| Field | Type | Description |
|-------|------|-------------|
| `repo_id` | string | Unique identifier |
| `team_id` | string | Owning team |
| `source_type` | SourceType | Source provider |
| `source_integration_id` | string? | Link to integration |
| `source_repo_id` | string | External repo ID |
| `owner_name` | string | Org/user name |
| `name` | string | Repository name |
| `full_name` | string | Full path (org/repo) |
| `default_branch` | string | Main branch |
| `is_private` | boolean | Visibility |
| `is_tracking` | boolean | Syncing commits/PRs |
| `sync_status` | RepositorySyncStatus | Sync state |

**SourceType Values:** `github`, `gitlab`, `bitbucket`, `azure_devops`

#### Commit
Git commit metadata.

| Field | Type | Description |
|-------|------|-------------|
| `commit_id` | string | Unique identifier |
| `repo_id` | string | Parent repository |
| `sha` | string | Full commit SHA |
| `contributor_id` | string | Author reference |
| `message` | string | Commit message |
| `stats` | CommitStats | Changes summary |
| `authored_at` | timestamp | Author timestamp |

#### PullRequest
Pull/merge request.

| Field | Type | Description |
|-------|------|-------------|
| `pr_id` | string | Unique identifier |
| `repo_id` | string | Parent repository |
| `number` | number | PR number |
| `title` | string | PR title |
| `state` | PullRequestState | Current state |
| `head_branch` | string | Source branch |
| `base_branch` | string | Target branch |
| `contributor_id` | string | Author reference |

**PullRequestState Values:** `open`, `merged`, `closed`, `draft`

---

## 4. Applications

### 4.1 Machines App (`/machines`)
Central hub for compute instance management.

**Features:**
- List all machines with filtering (status, provider, region, search)
- Machine cards showing status, IP, provider, region
- Deploy Wizard for creating new machines
- Machine actions: reboot, start, stop, destroy
- Grouping by provider, region, or status

**Deploy Wizard Steps:**
1. Select provider account
2. Choose region and zone
3. Select size (CPU, memory, disk)
4. Choose OS image
5. Configure SSH keys
6. Set bootstrap profile (optional)
7. Configure firewall profile (optional)
8. Add tags and name
9. Review and deploy

### 4.2 Providers App (`/providers`)
Manage cloud provider credentials.

**Features:**
- List connected provider accounts
- Add new provider accounts with credentials
- Verify credential validity
- View account metadata and scopes
- Delete provider accounts

**Supported Providers:**
- DigitalOcean (API token)
- AWS (Access key + Secret key)
- GCP (Service account JSON)
- Hetzner (API token)

### 4.3 Keys App (`/keys`)
SSH key management.

**Features:**
- List SSH keys with fingerprints
- Generate new key pairs (ed25519, RSA, ECDSA)
- Import existing public keys
- Sync keys to provider accounts
- Delete keys

### 4.4 Deployments App (`/deployments`)
Terraform operation history and monitoring.

**Features:**
- List all deployments with status
- Filter by type, state, machine, date range
- View deployment details and plan summary
- Stream real-time logs via SSE
- Cancel in-progress deployments

### 4.5 Bootstrap App (`/bootstrap`)
Pre-configured machine setup profiles.

**Features:**
- List bootstrap profiles (system + custom)
- Create custom profiles
- Configure services to install
- Define configuration variables
- Preview cloud-init/script templates

### 4.6 Teams App (`/teams`)
Team management and switching.

**Features:**
- List teams user belongs to
- Create new teams
- Join teams via invite code
- Switch active team context

### 4.7 Members App (`/members`)
Team membership management.

**Features:**
- List team members with roles
- Filter by role, search by name
- View member details in sidekick
- Invite new members (generate invite codes)
- Update member roles (admin only)
- Remove members (admin only)

### 4.8 Integrations App (`/integrations`)
External service connections.

**Features:**
- List available integrations
- Connect integrations via OAuth
- View integration status and sync info
- Configure integration settings
- Disconnect integrations

**Supported Integrations:**
- GitHub (repositories, members)
- Slack (coming soon)
- Discord (coming soon)

### 4.9 Repositories App (`/repositories`)
Source code repository tracking.

**Features:**
- List tracked repositories
- Add repositories from connected integrations
- View repository details (branches, commits, PRs)
- Sync repository data
- Remove repositories

---

## 5. Features

### 5.1 Sidekick Panel
Slide-in detail panel for inspecting entities.

**Supported Details:**
- Machine details (status, networking, services)
- Deployment details (logs, plan, status)
- Member details (profile, role, activity)
- Integration details (status, sync info)
- Commit details (diff, stats, author)
- Repository details (branches, recent activity)

**Architecture:**
- Global sidekick store manages open/close state
- Detail components registered per entity type
- Consistent layout with header, content, actions

### 5.2 Terminal (SSH)
In-browser SSH terminal connections.

**Features:**
- WebSocket-based terminal sessions
- Connect to machines via SSH
- Terminal resize support
- Session management

### 5.3 Profile Settings
User profile and preferences management.

**Tabs:**
- **Profile**: Display name, email, avatar
- **Account**: Password change, sessions
- **Settings**: Theme, preferences

### 5.4 Machine Agent
Lightweight agent installed on machines for enhanced monitoring.

**Capabilities:**
- Heartbeat status reporting
- Service status monitoring
- Port/firewall scanning
- Health endpoint checks
- Service restart commands

---

## 6. API Reference

### 6.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/register` | User registration |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/sessions` | List user sessions |
| DELETE | `/api/auth/sessions/:id` | Revoke session |

### 6.2 Machines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/machines` | List machines |
| POST | `/api/machines` | Create machine |
| GET | `/api/machines/:id` | Get machine |
| POST | `/api/machines/:id/reboot` | Reboot machine |
| POST | `/api/machines/:id/start` | Start machine |
| POST | `/api/machines/:id/stop` | Stop machine |
| POST | `/api/machines/:id/destroy` | Destroy machine |
| GET | `/api/machines/:id/services` | Get machine services |
| POST | `/api/machines/:id/services/:name/restart` | Restart service |
| GET | `/api/machines/:id/networking` | Get firewall/ports |

### 6.3 Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | List supported providers |
| GET | `/api/providers/:type/options` | Get regions, sizes, images |
| GET | `/api/providers/accounts` | List provider accounts |
| POST | `/api/providers/:type/accounts` | Add provider account |
| POST | `/api/providers/accounts/:id/verify` | Verify credentials |
| DELETE | `/api/providers/accounts/:id` | Delete account |

### 6.4 Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deployments` | List deployments |
| GET | `/api/deployments/:id` | Get deployment |
| GET | `/api/deployments/:id/logs?stream=true` | Stream logs (SSE) |
| POST | `/api/deployments/:id/cancel` | Cancel deployment |
| POST | `/api/deployments/:id/approve` | Approve deployment |

### 6.5 SSH Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ssh/keys` | List SSH keys |
| POST | `/api/ssh/keys/generate` | Generate new key pair |
| POST | `/api/ssh/keys/import` | Import existing key |
| DELETE | `/api/ssh/keys/:id` | Delete key |
| POST | `/api/ssh/keys/:id/sync` | Sync to providers |

### 6.6 Bootstrap

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bootstrap/profiles` | List profiles |
| POST | `/api/bootstrap/profiles` | Create profile |
| GET | `/api/bootstrap/profiles/:id` | Get profile |
| PUT | `/api/bootstrap/profiles/:id` | Update profile |
| DELETE | `/api/bootstrap/profiles/:id` | Delete profile |
| GET | `/api/bootstrap/firewall-profiles` | List firewall profiles |

### 6.7 Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | List user's teams |
| POST | `/api/teams` | Create team |
| GET | `/api/teams/:id` | Get team |
| PUT | `/api/teams/:id` | Update team |
| DELETE | `/api/teams/:id` | Delete team |
| GET | `/api/teams/:id/members` | List members |
| POST | `/api/teams/:id/invites` | Create invite |
| POST | `/api/teams/join` | Join via invite code |
| PUT | `/api/teams/:id/members/:memberId` | Update member role |
| DELETE | `/api/teams/:id/members/:memberId` | Remove member |

### 6.8 Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List integrations |
| GET | `/api/integrations/:type/status` | Get integration status |
| GET | `/api/integrations/:type/setup` | Get setup info |
| POST | `/api/integrations/:type/setup` | Save OAuth credentials |
| GET | `/api/integrations/:type/connect` | Start OAuth flow |
| GET | `/api/integrations/:type/callback` | OAuth callback |
| POST | `/api/integrations/:type/sync` | Trigger sync |
| DELETE | `/api/integrations/:type` | Disconnect |

### 6.9 Repositories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/repositories` | List repositories |
| POST | `/api/repositories` | Add repository |
| GET | `/api/repositories/:id` | Get repository |
| DELETE | `/api/repositories/:id` | Remove repository |
| POST | `/api/repositories/:id/sync` | Sync repository |
| GET | `/api/repositories/:id/commits` | List commits |
| GET | `/api/repositories/:id/prs` | List pull requests |
| GET | `/api/repositories/:id/branches` | List branches |

### 6.10 Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit/events` | List audit events |
| GET | `/api/audit/events/:id` | Get event details |

---

## 7. Tech Stack

### 7.1 Frontend

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool |
| Tailwind CSS | Utility-first styling |
| TanStack Query | Data fetching & caching |
| Zustand | State management |
| Framer Motion | Animations |
| Lucide React | Icons |
| xterm.js | Terminal emulation |

### 7.2 Backend

| Technology | Purpose |
|------------|---------|
| Node.js 18+ | Runtime |
| Express | HTTP framework |
| TypeScript | Type safety |
| Zod | Request validation |
| better-sqlite3 | SQLite database |
| SSE | Real-time log streaming |
| Helmet | Security headers |
| bcrypt | Password hashing |

### 7.3 Infrastructure

| Technology | Purpose |
|------------|---------|
| Terraform | Infrastructure as Code |
| Docker | Containerization |
| Nginx | Reverse proxy |

### 7.4 Testing

| Technology | Purpose |
|------------|---------|
| Vitest | Unit testing |
| Playwright | E2E testing |
| Testing Library | React component testing |

---

## 8. Design System

### 8.1 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0a0e14` | Deep navy background |
| `--surface` | `#0d1117` | Elevated surfaces |
| `--surface-elevated` | `#161b22` | Cards, modals |
| `--border` | `#30363d` | Borders, dividers |
| `--text-primary` | `#e6edf3` | Primary text |
| `--text-secondary` | `#8b949e` | Secondary text |
| `--accent-primary` | `#00ffff` | Neon cyan accent |
| `--accent-success` | `#00ff88` | Success states |
| `--accent-warning` | `#ff9500` | Warning states |
| `--accent-error` | `#ff3366` | Error states |

### 8.2 Typography

| Style | Font | Usage |
|-------|------|-------|
| Code | JetBrains Mono | Monospace, terminal |
| UI | DM Sans | Interface text |

### 8.3 Component Library

**Primitives (`shared/ui/`):**
- Button, Input, Select, Checkbox
- Modal, Dropdown, Tooltip
- Card, Badge, Avatar
- Table, List, Tabs
- Spinner, Skeleton, Progress

**Shared Components (`shared/components/`):**
- EmptyState, ErrorState
- PageHeader, SectionHeader
- FilterBar, SearchInput
- CollapsibleGroup
- StatusBadge, ProviderIcon

---

## 9. Security

### 9.1 Authentication
- Session-based authentication with secure cookies
- Password hashing with bcrypt
- Session expiration and refresh
- Multiple session support with device tracking

### 9.2 Authorization
- Team-scoped resources (all resources belong to a team)
- Role-based access within teams (admin/member)
- API endpoints validate team membership

### 9.3 Credential Security
- Provider credentials encrypted with AES-256-GCM
- Encryption key stored separately in `.data/.encryption_key`
- Private SSH keys encrypted at rest

### 9.4 API Security
- CORS protection
- Helmet security headers
- Rate limiting on sensitive operations
- CSRF protection
- Input validation with Zod

### 9.5 Audit Trail
- All actions logged to audit events
- Actor, action, target, outcome recorded
- IP address and user agent captured

---

## 10. Deployment

### 10.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_SERVER_URL` | Public URL for agent heartbeats | `http://localhost:3001` |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `NODE_ENV` | Environment mode | `development` |

### 10.2 Docker Deployment

```bash
# Set public URL
export PUBLIC_SERVER_URL=https://machina.yourdomain.com

# Build and run
docker compose up -d
```

### 10.3 Manual Deployment

```bash
# Install dependencies
npm ci

# Build all packages
npm run build

# Start server
NODE_ENV=production node server/dist/index.js
```

---

## 11. Data Flow Examples

### 11.1 Machine Creation Flow

```
User clicks "Deploy Machine"
    ↓
Deploy Wizard collects configuration
    ↓
POST /api/machines with MachineCreateRequest
    ↓
Server creates Machine record (status: pending)
    ↓
Server creates Deployment record (type: create, state: queued)
    ↓
Terraform service generates workspace
    ↓
Deployment state → planning
    ↓
Terraform plan executed
    ↓
If auto-approve: state → applying
    ↓
Terraform apply executed
    ↓
Machine status → provisioning → running
    ↓
Deployment state → succeeded
    ↓
Real-time updates via SSE throughout
```

### 11.2 GitHub Integration Flow

```
User clicks "Connect GitHub"
    ↓
GET /api/integrations/github/setup returns OAuth requirements
    ↓
User configures OAuth app, saves client_id/secret
    ↓
POST /api/integrations/github/setup saves credentials
    ↓
GET /api/integrations/github/connect returns OAuth URL
    ↓
User authorizes GitHub App installation
    ↓
GitHub redirects to /api/integrations/github/callback
    ↓
Server exchanges code for tokens
    ↓
TeamIntegration record created
    ↓
POST /api/integrations/github/sync triggers data import
    ↓
Repositories and members synced to local database
```

---

## Appendix A: File Naming Conventions

- **Components**: PascalCase (`MachineCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useMachineActions.ts`)
- **Styles**: Module CSS (`Component.module.css`)
- **Types**: snake_case for fields, PascalCase for types
- **Routes**: kebab-case for endpoints
- **Tests**: `*.test.ts` or `*.test.tsx`

## Appendix B: State Management

**Zustand Stores:**
- `authStore` - Authentication state, current user
- `teamStore` - Active team, team list
- `preferencesStore` - User preferences, theme
- `sidekickStore` - Sidekick panel state

**TanStack Query Keys:**
- `['machines']`, `['machines', id]`
- `['providers']`, `['providers', 'accounts']`
- `['deployments']`, `['deployments', id]`
- `['teams']`, `['teams', id, 'members']`
- `['integrations']`, `['integrations', type]`
- `['repositories']`, `['repositories', id]`
