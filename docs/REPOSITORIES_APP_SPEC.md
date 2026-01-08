# Repositories App Specification

## Overview

The **Repositories App** provides a dedicated view for managing source code repositories within a team. Unlike the raw GitHub integration data (which syncs everything accessible), this app allows users to selectively add specific repositories to track, sync commit history, and view pull requests by contributor.

**Key Design Principles:**

1. **Provider Agnostic** — Core data models abstract away provider-specific details (GitHub, GitLab, Bitbucket, etc.)
2. **Selective Tracking** — Users choose which repositories to actively track vs. just having integration access
3. **Historical Data** — Full commit and PR history, not just current state
4. **Contributor Attribution** — All activity linked to contributors for analytics

**MVP Focus**: GitHub integration with commit and PR syncing.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Data Model](#data-model)
3. [Shared Types](#shared-types)
4. [Database Schema](#database-schema)
5. [Backend API](#backend-api)
6. [Frontend Components](#frontend-components)
7. [Sidekick Integration](#sidekick-integration)
8. [Implementation Checklist](#implementation-checklist)

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Repositories Framework                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐         ┌─────────────────────────────────┐   │
│  │    Integrations App     │────────▶│     GitHub/GitLab Repos         │   │
│  │  (OAuth, Sync All Repos)│         │   (github_repositories table)   │   │
│  └─────────────────────────┘         └───────────────┬─────────────────┘   │
│                                                      │                      │
│                                                      │ "Add to Repositories"│
│                                                      ▼                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Repositories App                                  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    repositories (generic)                        │ │  │
│  │  │  - repo_id, team_id, name, source_type, source_integration_id   │ │  │
│  │  │  - external_repo_id, url, default_branch                        │ │  │
│  │  └───────────────────────────┬─────────────────────────────────────┘ │  │
│  │                              │                                        │  │
│  │           ┌──────────────────┴──────────────────┐                    │  │
│  │           ▼                                     ▼                    │  │
│  │  ┌─────────────────────┐            ┌─────────────────────────┐     │  │
│  │  │  commits (generic)  │            │ pull_requests (generic) │     │  │
│  │  │  - commit_id        │            │ - pr_id                 │     │  │
│  │  │  - repo_id          │            │ - repo_id               │     │  │
│  │  │  - sha              │            │ - number                │     │  │
│  │  │  - author_id        │            │ - author_id             │     │  │
│  │  │  - message, stats   │            │ - title, state          │     │  │
│  │  │  - html_url (→ diff)│            │ - reviews, labels       │     │  │
│  │  └─────────────────────┘            └─────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      contributors (generic)                           │  │
│  │  - Linked to team members, GitHub members, or standalone             │  │
│  │  - contributor_id, team_id, name, email, external_accounts[]         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Repository** | A tracked source code repository (abstracted from provider) |
| **Source Type** | The provider type (`github`, `gitlab`, `bitbucket`, `azure_devops`) |
| **Commit** | Generic commit metadata (SHA, author, message, timestamp, stats) |
| **Commit Diff** | The actual file changes and diff content for a commit |
| **Pull Request** | A merge/pull request with associated commits |
| **Contributor** | A person who has made commits (may be linked to team member) |

---

## Data Model

### Entity Relationships

```
Team (existing)
  └── Repository (1:many)
        ├── source_integration → TeamIntegration (optional, for synced repos)
        │
        ├── Branch (1:many)
        │     └── protection_rules (JSON, optional)
        │
        ├── Commit (1:many)
        │     ├── html_url → view diff on GitHub/GitLab
        │     └── tag_names[] (tags pointing here)
        │
        ├── PullRequest (1:many)
        │     ├── PullRequestCommit (many:many with Commit)
        │     ├── PullRequestReview (1:many)
        │     └── PullRequestLabel (1:many)
        │
        ├── Tag (1:many)
        │     └── sha → Commit
        │
        ├── Release (1:many)
        │     ├── tag_name → Tag
        │     └── assets[] (JSON array)
        │
        └── Contributor (via commits/PRs)

Contributor
  ├── team_member_id? → TeamMember (optional link)
  └── external_accounts[] (ContributorExternalAccount)
        ├── GitHub login
        ├── GitLab username
        └── email addresses
```

### Data Flow

1. **Adding a Repository**:
   - User goes to Repositories app
   - Clicks "Add Repository"
   - Modal shows available repos from connected integrations (GitHub, etc.)
   - User selects repo(s) to track
   - System creates `repositories` entry with link to source

2. **Syncing Commits**:
   - Manual sync or scheduled background job
   - Fetch commits from provider API
   - Map author to contributor (create if new)
   - Store commit metadata (SHA, message, author, date, stats)
   - Diff viewed via `html_url` link to GitHub/GitLab (not stored locally)

3. **Syncing Pull Requests**:
   - Fetch PRs from provider API
   - Link to commits and contributors
   - Track state (open, merged, closed)

---

## Shared Types

### File: `shared/src/types/repository.ts`

```typescript
// ============ Source Code System Types ============

/**
 * Supported source code providers
 * Abstract away provider-specific details
 */
export type SourceType = 'github' | 'gitlab' | 'bitbucket' | 'azure_devops';

/**
 * Repository sync status
 */
export type RepositorySyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/**
 * Pull request states (normalized across providers)
 */
export type PullRequestState = 'open' | 'merged' | 'closed' | 'draft';

// ============ Repository ============

/**
 * A tracked repository (provider-agnostic)
 */
export interface Repository {
  repo_id: string;
  team_id: string;
  
  // Source information
  source_type: SourceType;
  source_integration_id?: string;    // Link to team_integrations if synced
  source_repo_id: string;            // External ID (e.g., GitHub repo_id as string)
  
  // Organization/Owner
  owner_type: 'organization' | 'user';
  owner_name: string;                // Organization or user name
  owner_id?: string;                 // External owner ID
  owner_avatar_url?: string;
  
  // Repository metadata
  name: string;
  full_name: string;                 // e.g., "org/repo-name"
  description?: string;
  url: string;                       // Web URL to repository
  clone_url?: string;                // Git clone URL
  ssh_url?: string;                  // SSH clone URL
  default_branch: string;
  
  // Visibility
  is_private: boolean;
  is_archived: boolean;
  
  // Language
  primary_language?: string;
  
  // Stats (current snapshot)
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  
  // Tracking settings
  is_tracking: boolean;              // Whether to sync commits/PRs
  tracking_since?: string;           // Only sync commits after this date
  tracked_branches: string[];        // Branches to track (empty = all/default only)
  
  // Sync state
  sync_status: RepositorySyncStatus;
  last_sync_at?: string;
  last_sync_error?: string;
  commits_synced_count: number;
  prs_synced_count: number;
  branches_synced_count: number;
  
  // Timestamps
  created_at_source: string;         // When repo was created on GitHub/etc
  pushed_at_source?: string;         // Last push on source
  added_at: string;                  // When added to Repositories app
  updated_at: string;
}

// ============ Branch ============

/**
 * A branch in a repository
 */
export interface Branch {
  branch_id: string;
  repo_id: string;
  team_id: string;
  
  // Identity
  name: string;                      // e.g., "main", "feature/foo"
  
  // State
  sha: string;                       // Current HEAD commit SHA
  is_default: boolean;
  is_protected: boolean;
  
  // Protection rules (if protected)
  protection_rules?: BranchProtectionRules;
  
  // Stats
  ahead_of_default: number;          // Commits ahead of default branch
  behind_default: number;            // Commits behind default branch
  
  // Timestamps
  last_commit_at?: string;
  synced_at: string;
}

/**
 * Branch protection rules (normalized across providers)
 */
export interface BranchProtectionRules {
  required_approving_reviews: number;
  require_code_owner_review: boolean;
  require_signed_commits: boolean;
  require_linear_history: boolean;
  allow_force_pushes: boolean;
  allow_deletions: boolean;
}

/**
 * Repository with contributor count for list views
 */
export interface RepositoryWithStats extends Repository {
  contributor_count: number;
  recent_commit_count: number;       // Last 30 days
  open_pr_count: number;
}

// ============ Contributor ============

/**
 * External account linkage for a contributor
 */
export interface ContributorExternalAccount {
  source_type: SourceType;
  external_id: string;               // GitHub user_id, GitLab user_id, etc.
  username: string;                  // GitHub login, GitLab username
  avatar_url?: string;
  profile_url?: string;
}

/**
 * A contributor (author of commits/PRs)
 * May or may not be linked to a team member
 */
export interface Contributor {
  contributor_id: string;
  team_id: string;
  
  // Identity (derived from commits)
  name: string;                      // From commit author name
  email: string;                     // Primary email (from commits)
  emails: string[];                  // All known emails
  
  // Optional link to team membership
  team_member_id?: string;
  
  // External accounts
  external_accounts: ContributorExternalAccount[];
  
  // Stats
  total_commits: number;
  total_prs: number;
  first_commit_at?: string;
  last_commit_at?: string;
  
  created_at: string;
  updated_at: string;
}

// ============ Commit ============

/**
 * Commit file stats
 */
export interface CommitStats {
  additions: number;
  deletions: number;
  files_changed: number;
}

/**
 * A commit (provider-agnostic metadata)
 */
export interface Commit {
  commit_id: string;
  repo_id: string;
  team_id: string;
  
  // Commit identity
  sha: string;                       // Full commit SHA
  short_sha: string;                 // First 7 chars
  
  // Branch context
  branch_name?: string;              // Branch this commit was made on (if known)
  is_on_default_branch: boolean;     // Is this on the default branch?
  
  // Author info
  contributor_id: string;
  author_name: string;               // Raw author name from commit
  author_email: string;              // Raw author email from commit
  authored_at: string;               // When the commit was authored
  
  // Committer info (may differ from author)
  committer_name?: string;
  committer_email?: string;
  committed_at: string;              // When the commit was committed
  
  // Commit content
  message: string;                   // Full commit message
  message_headline: string;          // First line of message
  
  // Stats
  stats: CommitStats;
  
  // Source info
  source_type: SourceType;
  html_url: string;                  // URL to view commit and diff on GitHub/GitLab
  
  // Relationships
  parent_shas: string[];             // Parent commit SHAs
  pr_numbers?: number[];             // Associated PR numbers
  tag_names?: string[];              // Tags pointing to this commit
  
  // Metadata
  is_merge_commit: boolean;
  
  synced_at: string;                 // When we synced this commit
}

/**
 * Commit with repository info for list views
 */
export interface CommitWithRepo extends Commit {
  repository: {
    repo_id: string;
    name: string;
    full_name: string;
  };
  contributor: {
    contributor_id: string;
    name: string;
    avatar_url?: string;
  };
}

// ============ Pull Request ============

/**
 * PR Review state
 */
export type PullRequestReviewState = 'approved' | 'changes_requested' | 'commented' | 'pending' | 'dismissed';

/**
 * A review on a pull request
 */
export interface PullRequestReview {
  review_id: string;
  pr_id: string;
  
  // Reviewer
  contributor_id: string;
  reviewer_username: string;
  reviewer_avatar_url?: string;
  
  // Review content
  state: PullRequestReviewState;
  body?: string;
  
  // Timestamps
  submitted_at: string;
}

/**
 * A label/tag on a pull request
 */
export interface PullRequestLabel {
  name: string;
  color: string;                     // Hex color without #
  description?: string;
}

/**
 * A pull/merge request (provider-agnostic)
 */
export interface PullRequest {
  pr_id: string;
  repo_id: string;
  team_id: string;
  
  // PR identity
  number: number;                    // PR number in the repo
  source_type: SourceType;
  source_pr_id: string;              // External ID
  
  // Content
  title: string;
  body?: string;
  
  // State
  state: PullRequestState;
  is_draft: boolean;
  
  // Author
  contributor_id: string;
  author_username: string;
  
  // Branches
  head_branch: string;               // Source branch
  head_sha: string;                  // Latest commit SHA on head
  head_repo_full_name?: string;      // For cross-repo PRs (forks)
  base_branch: string;               // Target branch
  base_sha: string;                  // Base commit SHA
  
  // Labels
  labels: PullRequestLabel[];
  
  // Reviews
  reviews: PullRequestReview[];
  review_decision?: 'approved' | 'changes_requested' | 'review_required';
  
  // Merge info
  merged_at?: string;
  merged_by_contributor_id?: string;
  merge_commit_sha?: string;
  
  // Stats
  commits_count: number;
  additions: number;
  deletions: number;
  changed_files: number;
  comments_count: number;
  review_comments_count: number;
  
  // URLs
  html_url: string;
  
  // Timestamps
  created_at: string;                // When PR was opened
  updated_at: string;                // Last activity
  closed_at?: string;
  
  synced_at: string;
}

/**
 * PR with associated data for list views
 */
export interface PullRequestWithDetails extends PullRequest {
  repository: {
    repo_id: string;
    name: string;
    full_name: string;
  };
  contributor: {
    contributor_id: string;
    name: string;
    avatar_url?: string;
  };
}

// ============ Tags & Releases ============

/**
 * A git tag
 */
export interface Tag {
  tag_id: string;
  repo_id: string;
  team_id: string;
  
  // Identity
  name: string;                      // e.g., "v1.2.3"
  sha: string;                       // Commit SHA this tag points to
  
  // Tag metadata (for annotated tags)
  is_annotated: boolean;
  message?: string;
  tagger_name?: string;
  tagger_email?: string;
  tagged_at?: string;
  
  // URLs
  html_url: string;
  tarball_url?: string;
  zipball_url?: string;
  
  synced_at: string;
}

/**
 * A release (GitHub Releases, GitLab Releases, etc.)
 */
export interface Release {
  release_id: string;
  repo_id: string;
  team_id: string;
  
  // Identity
  source_release_id: string;
  tag_name: string;                  // Associated tag
  name: string;                      // Release title
  
  // Content
  body?: string;                     // Release notes (markdown)
  body_html?: string;                // Rendered HTML
  
  // State
  is_draft: boolean;
  is_prerelease: boolean;
  
  // Author
  contributor_id: string;
  author_username: string;
  
  // Assets
  assets: ReleaseAsset[];
  
  // URLs
  html_url: string;
  
  // Timestamps
  created_at: string;
  published_at?: string;
  
  synced_at: string;
}

/**
 * An asset attached to a release
 */
export interface ReleaseAsset {
  name: string;
  content_type: string;
  size_bytes: number;
  download_count: number;
  download_url: string;
}

// ============ API Types ============

export interface RepositoryListFilter {
  search?: string;
  source_type?: SourceType;
  is_tracking?: boolean;
  sync_status?: RepositorySyncStatus;
}

export interface CommitListFilter {
  repo_id?: string;
  contributor_id?: string;
  since?: string;                    // ISO date
  until?: string;                    // ISO date
  search?: string;                   // Search message
  branch?: string;
}

export interface PullRequestListFilter {
  repo_id?: string;
  contributor_id?: string;
  state?: PullRequestState;
  search?: string;
}

export interface ContributorListFilter {
  search?: string;
  has_team_member?: boolean;
  repo_id?: string;
}

export interface BranchListFilter {
  repo_id?: string;
  is_protected?: boolean;
  search?: string;
}

export interface TagListFilter {
  repo_id?: string;
  search?: string;
}

export interface ReleaseListFilter {
  repo_id?: string;
  is_prerelease?: boolean;
  search?: string;
}

// ============ Add Repository Request ============

export interface AddRepositoryRequest {
  source_type: SourceType;
  source_integration_id: string;
  source_repo_id: string;
  tracking_since?: string;           // Optional: only sync commits after this date
}

export interface AddRepositoryFromGitHubRequest {
  github_repo_ids: string[];         // IDs from github_repositories table
  tracking_since?: string;
}

// ============ Sync Types ============

export interface RepositorySyncRequest {
  repo_id: string;
  sync_commits?: boolean;            // Default true
  sync_prs?: boolean;                // Default true
  force_full_sync?: boolean;         // Re-sync all history
}

export interface RepositorySyncResponse {
  success: boolean;
  repo_id: string;
  commits_synced: number;
  prs_synced: number;
  contributors_created: number;
  started_at: string;
  finished_at?: string;
  error?: string;
}
```

### Update: `shared/src/index.ts`

Add to exports:
```typescript
export * from './types/repository';
```

---

## Database Schema

### Add to `server/src/services/database.ts`

```sql
-- ============ Repositories Framework Tables ============

-- Repositories (provider-agnostic)
CREATE TABLE IF NOT EXISTS repositories (
  repo_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  
  -- Source information
  source_type TEXT NOT NULL,
  source_integration_id TEXT,
  source_repo_id TEXT NOT NULL,
  
  -- Organization/Owner
  owner_type TEXT NOT NULL DEFAULT 'organization',
  owner_name TEXT NOT NULL,
  owner_id TEXT,
  owner_avatar_url TEXT,
  
  -- Metadata
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  clone_url TEXT,
  ssh_url TEXT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  
  -- Visibility
  is_private INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  
  -- Language
  primary_language TEXT,
  
  -- Stats
  stargazers_count INTEGER NOT NULL DEFAULT 0,
  forks_count INTEGER NOT NULL DEFAULT 0,
  open_issues_count INTEGER NOT NULL DEFAULT 0,
  
  -- Tracking
  is_tracking INTEGER NOT NULL DEFAULT 1,
  tracking_since TEXT,
  tracked_branches TEXT NOT NULL DEFAULT '[]',
  
  -- Sync state
  sync_status TEXT NOT NULL DEFAULT 'idle',
  last_sync_at TEXT,
  last_sync_error TEXT,
  commits_synced_count INTEGER NOT NULL DEFAULT 0,
  prs_synced_count INTEGER NOT NULL DEFAULT 0,
  branches_synced_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at_source TEXT,
  pushed_at_source TEXT,
  added_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (source_integration_id) REFERENCES team_integrations(integration_id),
  UNIQUE(team_id, source_type, source_repo_id)
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  branch_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  
  -- Identity
  name TEXT NOT NULL,
  sha TEXT NOT NULL,
  
  -- State
  is_default INTEGER NOT NULL DEFAULT 0,
  is_protected INTEGER NOT NULL DEFAULT 0,
  
  -- Protection rules (JSON)
  protection_rules TEXT,
  
  -- Stats
  ahead_of_default INTEGER NOT NULL DEFAULT 0,
  behind_default INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  last_commit_at TEXT,
  synced_at TEXT NOT NULL,
  
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  UNIQUE(repo_id, name)
);

-- Contributors (provider-agnostic authors)
CREATE TABLE IF NOT EXISTS contributors (
  contributor_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  
  -- Identity
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  emails TEXT NOT NULL DEFAULT '[]',  -- JSON array of all known emails
  
  -- Team linkage
  team_member_id TEXT,
  
  -- External accounts (JSON array of ContributorExternalAccount)
  external_accounts TEXT NOT NULL DEFAULT '[]',
  
  -- Stats
  total_commits INTEGER NOT NULL DEFAULT 0,
  total_prs INTEGER NOT NULL DEFAULT 0,
  first_commit_at TEXT,
  last_commit_at TEXT,
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (team_member_id) REFERENCES team_members(team_member_id),
  UNIQUE(team_id, email)
);

-- Commits (provider-agnostic)
CREATE TABLE IF NOT EXISTS commits (
  commit_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  
  -- Identity
  sha TEXT NOT NULL,
  short_sha TEXT NOT NULL,
  
  -- Branch context
  branch_name TEXT,
  is_on_default_branch INTEGER NOT NULL DEFAULT 1,
  
  -- Author
  contributor_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  authored_at TEXT NOT NULL,
  
  -- Committer
  committer_name TEXT,
  committer_email TEXT,
  committed_at TEXT NOT NULL,
  
  -- Content
  message TEXT NOT NULL,
  message_headline TEXT NOT NULL,
  
  -- Stats (JSON)
  stats TEXT NOT NULL DEFAULT '{"additions":0,"deletions":0,"files_changed":0}',
  
  -- Source
  source_type TEXT NOT NULL,
  html_url TEXT NOT NULL,
  
  -- Relationships (JSON arrays)
  parent_shas TEXT NOT NULL DEFAULT '[]',
  pr_numbers TEXT,                   -- JSON array or NULL
  tag_names TEXT,                    -- JSON array of tag names pointing here
  
  -- Metadata
  is_merge_commit INTEGER NOT NULL DEFAULT 0,
  
  synced_at TEXT NOT NULL,
  
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (contributor_id) REFERENCES contributors(contributor_id),
  UNIQUE(repo_id, sha)
);

-- Pull Requests (provider-agnostic)
CREATE TABLE IF NOT EXISTS pull_requests (
  pr_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  
  -- Identity
  number INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_pr_id TEXT NOT NULL,
  
  -- Content
  title TEXT NOT NULL,
  body TEXT,
  
  -- State
  state TEXT NOT NULL DEFAULT 'open',
  is_draft INTEGER NOT NULL DEFAULT 0,
  
  -- Author
  contributor_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  
  -- Branches
  head_branch TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  head_repo_full_name TEXT,          -- For cross-repo PRs (forks)
  base_branch TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  
  -- Reviews
  review_decision TEXT,              -- 'approved', 'changes_requested', 'review_required'
  
  -- Merge info
  merged_at TEXT,
  merged_by_contributor_id TEXT,
  merge_commit_sha TEXT,
  
  -- Stats
  commits_count INTEGER NOT NULL DEFAULT 0,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  changed_files INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  review_comments_count INTEGER NOT NULL DEFAULT 0,
  
  -- URLs
  html_url TEXT NOT NULL,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  
  synced_at TEXT NOT NULL,
  
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (contributor_id) REFERENCES contributors(contributor_id),
  FOREIGN KEY (merged_by_contributor_id) REFERENCES contributors(contributor_id),
  UNIQUE(repo_id, number)
);

-- PR Reviews
CREATE TABLE IF NOT EXISTS pull_request_reviews (
  review_id TEXT PRIMARY KEY,
  pr_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  
  -- Reviewer
  contributor_id TEXT NOT NULL,
  reviewer_username TEXT NOT NULL,
  reviewer_avatar_url TEXT,
  
  -- Review content
  state TEXT NOT NULL,               -- 'approved', 'changes_requested', 'commented', 'pending', 'dismissed'
  body TEXT,
  
  -- Timestamps
  submitted_at TEXT NOT NULL,
  
  FOREIGN KEY (pr_id) REFERENCES pull_requests(pr_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (contributor_id) REFERENCES contributors(contributor_id)
);

-- PR Labels (many-to-many, labels can be reused)
CREATE TABLE IF NOT EXISTS pull_request_labels (
  pr_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,               -- Hex color without #
  description TEXT,
  PRIMARY KEY (pr_id, name),
  FOREIGN KEY (pr_id) REFERENCES pull_requests(pr_id) ON DELETE CASCADE
);

-- PR to Commit mapping (many-to-many)
CREATE TABLE IF NOT EXISTS pull_request_commits (
  pr_id TEXT NOT NULL,
  commit_id TEXT NOT NULL,
  PRIMARY KEY (pr_id, commit_id),
  FOREIGN KEY (pr_id) REFERENCES pull_requests(pr_id) ON DELETE CASCADE,
  FOREIGN KEY (commit_id) REFERENCES commits(commit_id) ON DELETE CASCADE
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  tag_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  
  -- Identity
  name TEXT NOT NULL,
  sha TEXT NOT NULL,
  
  -- Tag metadata (for annotated tags)
  is_annotated INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  tagger_name TEXT,
  tagger_email TEXT,
  tagged_at TEXT,
  
  -- URLs
  html_url TEXT NOT NULL,
  tarball_url TEXT,
  zipball_url TEXT,
  
  synced_at TEXT NOT NULL,
  
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  UNIQUE(repo_id, name)
);

-- Releases
CREATE TABLE IF NOT EXISTS releases (
  release_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  
  -- Identity
  source_release_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  name TEXT NOT NULL,
  
  -- Content
  body TEXT,
  body_html TEXT,
  
  -- State
  is_draft INTEGER NOT NULL DEFAULT 0,
  is_prerelease INTEGER NOT NULL DEFAULT 0,
  
  -- Author
  contributor_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  
  -- Assets (JSON array)
  assets TEXT NOT NULL DEFAULT '[]',
  
  -- URLs
  html_url TEXT NOT NULL,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  published_at TEXT,
  
  synced_at TEXT NOT NULL,
  
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  FOREIGN KEY (contributor_id) REFERENCES contributors(contributor_id),
  UNIQUE(repo_id, tag_name)
);

-- ============ Indexes ============

CREATE INDEX IF NOT EXISTS idx_repositories_team ON repositories(team_id);
CREATE INDEX IF NOT EXISTS idx_repositories_source ON repositories(source_type, source_integration_id);
CREATE INDEX IF NOT EXISTS idx_repositories_sync ON repositories(sync_status);
CREATE INDEX IF NOT EXISTS idx_repositories_tracking ON repositories(is_tracking);
CREATE INDEX IF NOT EXISTS idx_repositories_owner ON repositories(owner_name);

CREATE INDEX IF NOT EXISTS idx_branches_repo ON branches(repo_id);
CREATE INDEX IF NOT EXISTS idx_branches_team ON branches(team_id);
CREATE INDEX IF NOT EXISTS idx_branches_default ON branches(is_default);

CREATE INDEX IF NOT EXISTS idx_contributors_team ON contributors(team_id);
CREATE INDEX IF NOT EXISTS idx_contributors_email ON contributors(email);
CREATE INDEX IF NOT EXISTS idx_contributors_member ON contributors(team_member_id);

CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_team ON commits(team_id);
CREATE INDEX IF NOT EXISTS idx_commits_contributor ON commits(contributor_id);
CREATE INDEX IF NOT EXISTS idx_commits_authored ON commits(authored_at);
CREATE INDEX IF NOT EXISTS idx_commits_sha ON commits(sha);
CREATE INDEX IF NOT EXISTS idx_commits_branch ON commits(branch_name);

CREATE INDEX IF NOT EXISTS idx_pull_requests_repo ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_team ON pull_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_contributor ON pull_requests(contributor_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_state ON pull_requests(state);
CREATE INDEX IF NOT EXISTS idx_pull_requests_created ON pull_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_pull_requests_review ON pull_requests(review_decision);

CREATE INDEX IF NOT EXISTS idx_pr_reviews_pr ON pull_request_reviews(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_contributor ON pull_request_reviews(contributor_id);

CREATE INDEX IF NOT EXISTS idx_pr_labels_pr ON pull_request_labels(pr_id);

CREATE INDEX IF NOT EXISTS idx_pr_commits_pr ON pull_request_commits(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_commits_commit ON pull_request_commits(commit_id);

CREATE INDEX IF NOT EXISTS idx_tags_repo ON tags(repo_id);
CREATE INDEX IF NOT EXISTS idx_tags_team ON tags(team_id);
CREATE INDEX IF NOT EXISTS idx_tags_sha ON tags(sha);

CREATE INDEX IF NOT EXISTS idx_releases_repo ON releases(repo_id);
CREATE INDEX IF NOT EXISTS idx_releases_team ON releases(team_id);
CREATE INDEX IF NOT EXISTS idx_releases_tag ON releases(tag_name);
CREATE INDEX IF NOT EXISTS idx_releases_published ON releases(published_at);
```

---

## Backend API

### File: `server/src/routes/repositories.ts`

```typescript
import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
  ApiResponse,
  Repository,
  RepositoryWithStats,
  Commit,
  CommitWithRepo,
  CommitDiff,
  PullRequest,
  PullRequestWithDetails,
  Contributor,
  RepositoryListFilter,
  CommitListFilter,
  PullRequestListFilter,
  ContributorListFilter,
  AddRepositoryFromGitHubRequest,
  RepositorySyncRequest,
  RepositorySyncResponse,
} from '@machina/shared';
import { AppError } from '../middleware/errorHandler';
import { requireTeamAdmin } from '../middleware/auth';
import { database } from '../services/database';
import { repositorySyncService } from '../services/repositorySync';

export const repositoriesRouter = Router();

// ============ Repositories CRUD ============

// GET /repositories - List tracked repositories
repositoriesRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId!;
    const filter: RepositoryListFilter = {
      search: req.query.search as string,
      source_type: req.query.source_type as any,
      is_tracking: req.query.is_tracking === 'true' ? true : 
                   req.query.is_tracking === 'false' ? false : undefined,
      sync_status: req.query.sync_status as any,
    };
    
    const repos = database.getRepositories(teamId, filter);
    
    const response: ApiResponse<RepositoryWithStats[]> = {
      success: true,
      data: repos,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /repositories/:id - Get repository details
repositoriesRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId!;
    const { id } = req.params;
    
    const repo = database.getRepository(id, teamId);
    if (!repo) {
      throw new AppError(404, 'NOT_FOUND', 'Repository not found');
    }
    
    const response: ApiResponse<RepositoryWithStats> = {
      success: true,
      data: repo,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /repositories/from-github - Add repositories from GitHub integration
repositoriesRouter.post(
  '/from-github',
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { github_repo_ids, tracking_since }: AddRepositoryFromGitHubRequest = req.body;
      
      if (!github_repo_ids || github_repo_ids.length === 0) {
        throw new AppError(400, 'INVALID_REQUEST', 'No repositories specified');
      }
      
      const added: Repository[] = [];
      const now = new Date().toISOString();
      
      for (const githubRepoId of github_repo_ids) {
        // Get GitHub repo from integration data
        const githubRepo = database.getGitHubRepository(githubRepoId, teamId);
        if (!githubRepo) {
          continue; // Skip if not found
        }
        
        // Check if already tracked
        const existing = database.getRepositoryBySource(
          teamId, 'github', String(githubRepo.github_repo_id)
        );
        if (existing) {
          continue; // Already tracked
        }
        
        // Create repository record
        const repo: Repository = {
          repo_id: `repo_${uuidv4().substring(0, 20)}`,
          team_id: teamId,
          source_type: 'github',
          source_integration_id: githubRepo.integration_id,
          source_repo_id: String(githubRepo.github_repo_id),
          name: githubRepo.name,
          full_name: githubRepo.full_name,
          description: githubRepo.description,
          url: githubRepo.html_url,
          clone_url: `${githubRepo.html_url}.git`,
          default_branch: githubRepo.default_branch,
          is_private: githubRepo.private,
          is_archived: githubRepo.archived,
          is_tracking: true,
          tracking_since,
          sync_status: 'idle',
          commits_synced_count: 0,
          prs_synced_count: 0,
          added_at: now,
          updated_at: now,
        };
        
        database.insertRepository(repo);
        added.push(repo);
      }
      
      const response: ApiResponse<Repository[]> = {
        success: true,
        data: added,
      };
      
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /repositories/:id - Remove repository from tracking
repositoriesRouter.delete(
  '/:id',
  requireTeamAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { id } = req.params;
      
      const repo = database.getRepository(id, teamId);
      if (!repo) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }
      
      // Delete repository and cascade to commits, PRs, etc.
      database.deleteRepository(id);
      
      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /repositories/:id/sync - Sync repository commits and PRs
repositoriesRouter.post(
  '/:id/sync',
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const userId = req.user!.user_id;
      const { id } = req.params;
      const { sync_commits = true, sync_prs = true, force_full_sync = false }: RepositorySyncRequest = req.body;
      
      const repo = database.getRepository(id, teamId);
      if (!repo) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }
      
      // Start sync (async)
      const result = await repositorySyncService.syncRepository({
        repo,
        teamId,
        userId,
        syncCommits: sync_commits,
        syncPrs: sync_prs,
        forceFullSync: force_full_sync,
      });
      
      const response: ApiResponse<RepositorySyncResponse> = {
        success: true,
        data: result,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /repositories/:id - Update repository settings
repositoriesRouter.patch(
  '/:id',
  requireTeamAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { id } = req.params;
      const { is_tracking, tracking_since } = req.body;
      
      const repo = database.getRepository(id, teamId);
      if (!repo) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }
      
      database.updateRepository({
        repo_id: id,
        is_tracking: is_tracking ?? repo.is_tracking,
        tracking_since: tracking_since ?? repo.tracking_since,
        updated_at: new Date().toISOString(),
      });
      
      const updated = database.getRepository(id, teamId);
      
      const response: ApiResponse<Repository> = {
        success: true,
        data: updated!,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ============ Commits ============

// GET /repositories/:id/commits - List commits for a repository
repositoriesRouter.get('/:id/commits', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId!;
    const { id } = req.params;
    const filter: CommitListFilter = {
      repo_id: id,
      contributor_id: req.query.contributor_id as string,
      since: req.query.since as string,
      until: req.query.until as string,
      search: req.query.search as string,
      branch: req.query.branch as string,
    };
    
    const repo = database.getRepository(id, teamId);
    if (!repo) {
      throw new AppError(404, 'NOT_FOUND', 'Repository not found');
    }
    
    const commits = database.getCommits(teamId, filter);
    
    const response: ApiResponse<CommitWithRepo[]> = {
      success: true,
      data: commits,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /commits - List all commits across repositories
repositoriesRouter.get('/commits', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId!;
    const filter: CommitListFilter = {
      repo_id: req.query.repo_id as string,
      contributor_id: req.query.contributor_id as string,
      since: req.query.since as string,
      until: req.query.until as string,
      search: req.query.search as string,
    };
    
    const commits = database.getCommits(teamId, filter);
    
    const response: ApiResponse<CommitWithRepo[]> = {
      success: true,
      data: commits,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /commits/:sha - Get commit by SHA
repositoriesRouter.get('/commits/:sha', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId!;
    const { sha } = req.params;
    
    const commit = database.getCommitBySha(teamId, sha);
    if (!commit) {
      throw new AppError(404, 'NOT_FOUND', 'Commit not found');
    }
    
    const response: ApiResponse<CommitWithRepo> = {
      success: true,
      data: commit,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// ============ Pull Requests ============

// GET /repositories/:id/pull-requests - List PRs for a repository
repositoriesRouter.get(
  '/:id/pull-requests',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { id } = req.params;
      const filter: PullRequestListFilter = {
        repo_id: id,
        contributor_id: req.query.contributor_id as string,
        state: req.query.state as any,
        search: req.query.search as string,
      };
      
      const repo = database.getRepository(id, teamId);
      if (!repo) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }
      
      const prs = database.getPullRequests(teamId, filter);
      
      const response: ApiResponse<PullRequestWithDetails[]> = {
        success: true,
        data: prs,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /pull-requests - List all PRs across repositories
repositoriesRouter.get('/pull-requests', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId!;
    const filter: PullRequestListFilter = {
      repo_id: req.query.repo_id as string,
      contributor_id: req.query.contributor_id as string,
      state: req.query.state as any,
      search: req.query.search as string,
    };
    
    const prs = database.getPullRequests(teamId, filter);
    
    const response: ApiResponse<PullRequestWithDetails[]> = {
      success: true,
      data: prs,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /pull-requests/:prId - Get PR details
repositoriesRouter.get(
  '/pull-requests/:prId',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { prId } = req.params;
      
      const pr = database.getPullRequest(prId, teamId);
      if (!pr) {
        throw new AppError(404, 'NOT_FOUND', 'Pull request not found');
      }
      
      const response: ApiResponse<PullRequestWithDetails> = {
        success: true,
        data: pr,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /pull-requests/:prId/commits - Get commits for a PR
repositoriesRouter.get(
  '/pull-requests/:prId/commits',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { prId } = req.params;
      
      const pr = database.getPullRequest(prId, teamId);
      if (!pr) {
        throw new AppError(404, 'NOT_FOUND', 'Pull request not found');
      }
      
      const commits = database.getPullRequestCommits(prId);
      
      const response: ApiResponse<CommitWithRepo[]> = {
        success: true,
        data: commits,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ============ Contributors ============

// GET /contributors - List all contributors
repositoriesRouter.get('/contributors', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId!;
    const filter: ContributorListFilter = {
      search: req.query.search as string,
      has_team_member: req.query.has_team_member === 'true' ? true :
                       req.query.has_team_member === 'false' ? false : undefined,
      repo_id: req.query.repo_id as string,
    };
    
    const contributors = database.getContributors(teamId, filter);
    
    const response: ApiResponse<Contributor[]> = {
      success: true,
      data: contributors,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /contributors/:id - Get contributor details
repositoriesRouter.get(
  '/contributors/:id',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { id } = req.params;
      
      const contributor = database.getContributor(id, teamId);
      if (!contributor) {
        throw new AppError(404, 'NOT_FOUND', 'Contributor not found');
      }
      
      const response: ApiResponse<Contributor> = {
        success: true,
        data: contributor,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /contributors/:id/link-member - Link contributor to team member
repositoriesRouter.post(
  '/contributors/:id/link-member',
  requireTeamAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { id } = req.params;
      const { team_member_id } = req.body;
      
      const contributor = database.getContributor(id, teamId);
      if (!contributor) {
        throw new AppError(404, 'NOT_FOUND', 'Contributor not found');
      }
      
      if (team_member_id) {
        const member = database.getTeamMemberById(team_member_id);
        if (!member || member.team_id !== teamId) {
          throw new AppError(404, 'NOT_FOUND', 'Team member not found');
        }
      }
      
      database.updateContributor({
        contributor_id: id,
        team_member_id: team_member_id || null,
        updated_at: new Date().toISOString(),
      });
      
      const updated = database.getContributor(id, teamId);
      
      const response: ApiResponse<Contributor> = {
        success: true,
        data: updated!,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /contributors/:id/commits - Get commits by contributor
repositoriesRouter.get(
  '/contributors/:id/commits',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { id } = req.params;
      
      const contributor = database.getContributor(id, teamId);
      if (!contributor) {
        throw new AppError(404, 'NOT_FOUND', 'Contributor not found');
      }
      
      const commits = database.getCommits(teamId, { contributor_id: id });
      
      const response: ApiResponse<CommitWithRepo[]> = {
        success: true,
        data: commits,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /contributors/:id/pull-requests - Get PRs by contributor
repositoriesRouter.get(
  '/contributors/:id/pull-requests',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId!;
      const { id } = req.params;
      
      const contributor = database.getContributor(id, teamId);
      if (!contributor) {
        throw new AppError(404, 'NOT_FOUND', 'Contributor not found');
      }
      
      const prs = database.getPullRequests(teamId, { contributor_id: id });
      
      const response: ApiResponse<PullRequestWithDetails[]> = {
        success: true,
        data: prs,
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);
```

### Register Router in `server/src/index.ts`

```typescript
import { repositoriesRouter } from './routes/repositories';

// Add with other protected routes
app.use('/api/repositories', requireAuth, requireTeamContext, repositoriesRouter);
```

---

## Frontend Components

### File Structure

```
client/src/apps/repositories/
├── index.ts                         # Barrel export
├── RepositoriesApp.tsx              # Main app component
├── RepositoriesApp.module.css       # App styles
├── components/
│   ├── index.ts                     # Components barrel
│   ├── AddRepositoryModal/
│   │   ├── index.ts
│   │   ├── AddRepositoryModal.tsx
│   │   └── AddRepositoryModal.module.css
│   ├── RepositoryList/
│   │   ├── index.ts
│   │   ├── RepositoryList.tsx
│   │   └── RepositoryList.module.css
│   ├── CommitList/
│   │   ├── index.ts
│   │   ├── CommitList.tsx
│   │   └── CommitList.module.css
│   ├── PullRequestList/
│   │   ├── index.ts
│   │   ├── PullRequestList.tsx
│   │   └── PullRequestList.module.css
│   └── ContributorList/
│       ├── index.ts
│       ├── ContributorList.tsx
│       └── ContributorList.module.css
└── hooks/
    ├── index.ts
    ├── useRepositories.ts
    ├── useCommits.ts
    └── usePullRequests.ts
```

### Main App Component

```tsx
// client/src/apps/repositories/RepositoriesApp.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  Users,
  Plus,
} from 'lucide-react';
import type { RepositorySyncStatus } from '@machina/shared';
import { getRepositories } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, RefreshButton } from '@/shared/ui';
import {
  PageLayout,
  PageEmptyState,
  PageList,
  ItemCard,
  ItemCardMeta,
  ItemCardStatus,
  ItemCardBadge,
} from '@/shared/components';
import { AddRepositoryModal } from './components';
import styles from './RepositoriesApp.module.css';

type ViewMode = 'repositories' | 'commits' | 'pull-requests' | 'contributors';

export function RepositoriesApp() {
  const { addToast, setSidekickSelection } = useAppStore();
  const { currentTeamId, currentTeamRole } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('repositories');
  const [showAddModal, setShowAddModal] = useState(false);

  const {
    data: repositories,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['repositories', currentTeamId],
    queryFn: () => getRepositories(),
  });

  const isAdmin = currentTeamRole === 'admin';
  const repoCount = repositories?.length ?? 0;

  const getSyncStatusVariant = (status: RepositorySyncStatus): 'valid' | 'muted' | 'warning' => {
    switch (status) {
      case 'synced': return 'valid';
      case 'syncing': return 'warning';
      case 'error': return 'warning';
      default: return 'muted';
    }
  };

  return (
    <PageLayout
      title="Repositories"
      count={repoCount}
      isLoading={isLoading}
      actions={
        <>
          <div className={styles.viewTabs}>
            <button
              className={`${styles.viewTab} ${viewMode === 'repositories' ? styles.viewTabActive : ''}`}
              onClick={() => setViewMode('repositories')}
            >
              <GitBranch size={14} />
              Repos
            </button>
            <button
              className={`${styles.viewTab} ${viewMode === 'commits' ? styles.viewTabActive : ''}`}
              onClick={() => setViewMode('commits')}
            >
              <GitCommit size={14} />
              Commits
            </button>
            <button
              className={`${styles.viewTab} ${viewMode === 'pull-requests' ? styles.viewTabActive : ''}`}
              onClick={() => setViewMode('pull-requests')}
            >
              <GitPullRequest size={14} />
              PRs
            </button>
            <button
              className={`${styles.viewTab} ${viewMode === 'contributors' ? styles.viewTabActive : ''}`}
              onClick={() => setViewMode('contributors')}
            >
              <Users size={14} />
              Contributors
            </button>
          </div>
          <RefreshButton
            onRefresh={() => refetch()}
            isRefreshing={isRefetching}
          />
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={14} />
              Add Repository
            </Button>
          )}
        </>
      }
    >
      {viewMode === 'repositories' && (
        <>
          {repositories && repositories.length > 0 ? (
            <PageList>
              {repositories.map((repo) => (
                <ItemCard
                  key={repo.repo_id}
                  iconBadge={<GitBranch size={14} />}
                  title={repo.full_name}
                  titleSans
                  onClick={() => setSidekickSelection({ type: 'repository', id: repo.repo_id })}
                  statusBadge={
                    <ItemCardStatus variant={getSyncStatusVariant(repo.sync_status)}>
                      {repo.sync_status === 'syncing' ? 'Syncing...' : 
                       repo.sync_status === 'synced' ? 'Synced' :
                       repo.sync_status === 'error' ? 'Error' : 'Idle'}
                    </ItemCardStatus>
                  }
                  meta={
                    <>
                      {repo.description && (
                        <ItemCardMeta>{repo.description}</ItemCardMeta>
                      )}
                      <ItemCardMeta>
                        {repo.commits_synced_count} commits • {repo.prs_synced_count} PRs
                      </ItemCardMeta>
                    </>
                  }
                  badges={
                    <>
                      <ItemCardBadge>{repo.source_type}</ItemCardBadge>
                      <ItemCardBadge>{repo.default_branch}</ItemCardBadge>
                      {repo.is_private && <ItemCardBadge>private</ItemCardBadge>}
                      {repo.contributor_count > 0 && (
                        <ItemCardBadge>{repo.contributor_count} contributors</ItemCardBadge>
                      )}
                    </>
                  }
                />
              ))}
            </PageList>
          ) : (
            <PageEmptyState
              title="No repositories tracked"
              description="Add repositories from your connected integrations to start tracking commits and pull requests."
              action={
                isAdmin && (
                  <Button variant="primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={14} />
                    Add Repository
                  </Button>
                )
              }
            />
          )}
        </>
      )}

      {viewMode === 'commits' && (
        <CommitListView />
      )}

      {viewMode === 'pull-requests' && (
        <PullRequestListView />
      )}

      {viewMode === 'contributors' && (
        <ContributorListView />
      )}

      {showAddModal && (
        <AddRepositoryModal onClose={() => setShowAddModal(false)} />
      )}
    </PageLayout>
  );
}
```

### Styles

```css
/* client/src/apps/repositories/RepositoriesApp.module.css */

.viewTabs {
  display: flex;
  gap: 2px;
  background: var(--surface-2);
  padding: 2px;
  border-radius: 6px;
  margin-right: 8px;
}

.viewTab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-family: var(--font-sans);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.viewTab:hover {
  color: var(--text-primary);
  background: var(--surface-3);
}

.viewTabActive {
  background: var(--surface-3);
  color: var(--text-primary);
}

.commitMessage {
  font-family: var(--font-mono);
  font-size: 12px;
}

.commitSha {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 4px;
}

.prNumber {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent-primary);
}

.prStateBadge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.prStateOpen {
  background: var(--status-running-bg);
  color: var(--status-running);
}

.prStateMerged {
  background: var(--accent-purple-bg, rgba(139, 92, 246, 0.15));
  color: var(--accent-purple, #8b5cf6);
}

.prStateClosed {
  background: var(--status-terminated-bg);
  color: var(--status-terminated);
}

.contributorAvatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  overflow: hidden;
}

.contributorAvatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.statsGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.statCard {
  background: var(--surface-2);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.statValue {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.statLabel {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## Sidekick Integration

### Update SidekickItemType

In `client/src/store/appStore.ts`:

```typescript
export type SidekickItemType =
  | 'machine'
  | 'provider'
  | 'key'
  | 'deployment'
  | 'bootstrap'
  | 'team'
  | 'integration'
  | 'member'
  | 'repository'      // NEW
  | 'commit'          // NEW
  | 'pull_request'    // NEW
  | 'contributor';    // NEW
```

### Sidekick Detail Components

Create detail views in `client/src/features/sidekick/details/`:

```
RepositoryDetail/
├── index.ts
├── RepositoryDetail.tsx
├── RepositoryDetail.module.css
├── RepositoryOverview.tsx
├── RepositoryCommits.tsx
└── RepositoryPRs.tsx

CommitDetail/
├── index.ts
├── CommitDetail.tsx
└── CommitDetail.module.css

PullRequestDetail/
├── index.ts
├── PullRequestDetail.tsx
├── PullRequestDetail.module.css
└── PullRequestCommits.tsx

ContributorDetail/
├── index.ts
├── ContributorDetail.tsx
├── ContributorDetail.module.css
├── ContributorCommits.tsx
└── ContributorPRs.tsx
```

### RepositoryDetail Component

```tsx
// client/src/features/sidekick/details/RepositoryDetail/RepositoryDetail.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GitBranch, RefreshCw, ExternalLink, GitCommit, GitPullRequest } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { RepositoryWithStats } from '@machina/shared';
import { getRepository, syncRepository } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/shared/ui';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickActionBar,
} from '../../components';
import { RepositoryOverview } from './RepositoryOverview';
import { RepositoryCommits } from './RepositoryCommits';
import { RepositoryPRs } from './RepositoryPRs';
import styles from './RepositoryDetail.module.css';

interface RepositoryDetailProps {
  repositoryId: string;
  onClose: () => void;
  onMinimize: () => void;
}

export function RepositoryDetail({ repositoryId, onClose, onMinimize }: RepositoryDetailProps) {
  const { addToast } = useAppStore();
  const { currentTeamRole } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'commits' | 'prs'>('overview');

  const { data: repository, isLoading } = useQuery({
    queryKey: ['repository', repositoryId],
    queryFn: () => getRepository(repositoryId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncRepository(repositoryId),
    onSuccess: (result) => {
      addToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synced ${result.commits_synced} commits and ${result.prs_synced} PRs`,
      });
      queryClient.invalidateQueries({ queryKey: ['repository', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Sync Failed',
        message: error.message,
      });
    },
  });

  const isAdmin = currentTeamRole === 'admin';

  if (isLoading || !repository) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <>
      <SidekickHeader
        icon={<GitBranch size={16} />}
        name={repository.full_name}
        nameSans
        subtitle={repository.description || repository.url}
        onClose={onClose}
        onMinimize={onMinimize}
        actions={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => window.open(repository.url, '_blank')}
            title="Open in browser"
          >
            <ExternalLink size={14} />
          </Button>
        }
      />

      <SidekickTabs
        tabs={[
          { id: 'overview', label: 'Overview', icon: GitBranch },
          { id: 'commits', label: 'Commits', icon: GitCommit, count: repository.commits_synced_count },
          { id: 'prs', label: 'Pull Requests', icon: GitPullRequest, count: repository.prs_synced_count },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
      />

      <SidekickContent>
        {activeTab === 'overview' && (
          <RepositoryOverview repository={repository} />
        )}
        {activeTab === 'commits' && (
          <RepositoryCommits repositoryId={repositoryId} />
        )}
        {activeTab === 'prs' && (
          <RepositoryPRs repositoryId={repositoryId} />
        )}
      </SidekickContent>

      {isAdmin && (
        <SidekickActionBar>
          <Button
            variant="primary"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || repository.sync_status === 'syncing'}
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
          </Button>
          {repository.last_sync_at && (
            <span className={styles.lastSync}>
              Last synced {formatDistanceToNow(new Date(repository.last_sync_at), { addSuffix: true })}
            </span>
          )}
        </SidekickActionBar>
      )}
    </>
  );
}
```

---

## Navigation

### Update Appbar

Add Repositories to the navigation in `client/src/app/layouts/Appbar/Appbar.tsx`:

```typescript
import { GitBranch } from 'lucide-react';

const navItems: NavItem[] = [
  { to: '/machines', icon: Server, label: 'Machines' },
  { to: '/providers', icon: Cloud, label: 'Providers' },
  { to: '/keys', icon: Key, label: 'Keys' },
  { to: '/deployments', icon: GitBranch, label: 'Deployments' },
  { to: '/bootstrap', icon: Package, label: 'Bootstrap' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/repositories', icon: GitBranch, label: 'Repositories' },  // NEW
  { to: '/members', icon: Users, label: 'Members' },
];
```

### Update App.tsx Routes

```typescript
const RepositoriesApp = lazy(() =>
  import('./apps/repositories/RepositoriesApp').then((m) => ({ default: m.RepositoriesApp }))
);

// In Routes:
<Route
  path="repositories"
  element={
    <Suspense fallback={<PageLoader />}>
      <RepositoriesApp />
    </Suspense>
  }
/>
```

---

## API Client Functions

Add to `client/src/lib/api.ts`:

```typescript
// ============ Repositories API ============

export async function getRepositories(
  filter?: RepositoryListFilter
): Promise<RepositoryWithStats[]> {
  return fetchApi<RepositoryWithStats[]>(`/repositories${buildQueryString(filter)}`);
}

export async function getRepository(repoId: string): Promise<RepositoryWithStats> {
  return fetchApi<RepositoryWithStats>(`/repositories/${repoId}`);
}

export async function addRepositoriesFromGitHub(
  request: AddRepositoryFromGitHubRequest
): Promise<Repository[]> {
  return fetchApi<Repository[]>('/repositories/from-github', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function syncRepository(
  repoId: string,
  options?: Partial<RepositorySyncRequest>
): Promise<RepositorySyncResponse> {
  return fetchApi<RepositorySyncResponse>(`/repositories/${repoId}/sync`, {
    method: 'POST',
    body: JSON.stringify({ repo_id: repoId, ...options }),
  });
}

export async function deleteRepository(repoId: string): Promise<void> {
  await fetchApi(`/repositories/${repoId}`, { method: 'DELETE' });
}

// ============ Commits API ============

export async function getCommits(
  filter?: CommitListFilter
): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/commits${buildQueryString(filter)}`);
}

export async function getRepositoryCommits(
  repoId: string,
  filter?: Omit<CommitListFilter, 'repo_id'>
): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/${repoId}/commits${buildQueryString(filter)}`);
}

export async function getCommit(sha: string): Promise<CommitWithRepo> {
  return fetchApi<CommitWithRepo>(`/repositories/commits/${sha}`);
}

// Note: To view commit diff, use commit.html_url to open in GitHub/GitLab

// ============ Pull Requests API ============

export async function getPullRequests(
  filter?: PullRequestListFilter
): Promise<PullRequestWithDetails[]> {
  return fetchApi<PullRequestWithDetails[]>(`/repositories/pull-requests${buildQueryString(filter)}`);
}

export async function getRepositoryPullRequests(
  repoId: string,
  filter?: Omit<PullRequestListFilter, 'repo_id'>
): Promise<PullRequestWithDetails[]> {
  return fetchApi<PullRequestWithDetails[]>(`/repositories/${repoId}/pull-requests${buildQueryString(filter)}`);
}

export async function getPullRequest(prId: string): Promise<PullRequestWithDetails> {
  return fetchApi<PullRequestWithDetails>(`/repositories/pull-requests/${prId}`);
}

export async function getPullRequestCommits(prId: string): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/pull-requests/${prId}/commits`);
}

// ============ Contributors API ============

export async function getContributors(
  filter?: ContributorListFilter
): Promise<Contributor[]> {
  return fetchApi<Contributor[]>(`/repositories/contributors${buildQueryString(filter)}`);
}

export async function getContributor(contributorId: string): Promise<Contributor> {
  return fetchApi<Contributor>(`/repositories/contributors/${contributorId}`);
}

export async function linkContributorToMember(
  contributorId: string,
  teamMemberId: string | null
): Promise<Contributor> {
  return fetchApi<Contributor>(`/repositories/contributors/${contributorId}/link-member`, {
    method: 'POST',
    body: JSON.stringify({ team_member_id: teamMemberId }),
  });
}

export async function getContributorCommits(contributorId: string): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/contributors/${contributorId}/commits`);
}

export async function getContributorPullRequests(contributorId: string): Promise<PullRequestWithDetails[]> {
  return fetchApi<PullRequestWithDetails[]>(`/repositories/contributors/${contributorId}/pull-requests`);
}
```

---

---

## What We're Tracking (Summary)

### Repository Level
| Field | Description |
|-------|-------------|
| **Owner/Org** | Organization or user that owns the repo |
| **Visibility** | Private, archived flags |
| **Language** | Primary language |
| **Stats** | Stars, forks, open issues |

### Branch Level
| Field | Description |
|-------|-------------|
| **Protection** | Is protected? What rules? |
| **HEAD SHA** | Current branch head |
| **Divergence** | Ahead/behind default branch |

### Commit Level
| Field | Description |
|-------|-------------|
| **Branch** | Which branch the commit was made on |
| **Tags** | Tags pointing to this commit |
| **Parents** | Parent commit SHAs (for merge detection) |

### Pull Request Level
| Field | Description |
|-------|-------------|
| **Labels** | PR labels with colors |
| **Reviews** | Who reviewed, what decision |
| **Cross-repo** | Fork PRs with head repo info |

### Release/Tag Level
| Field | Description |
|-------|-------------|
| **Tags** | All tags with annotation info |
| **Releases** | GitHub Releases with assets |

---

## Implementation Checklist

### Phase 1: Core Types & Database

- [ ] Create `shared/src/types/repository.ts`
- [ ] Update `shared/src/index.ts` to export repository types
- [ ] Add database tables to `server/src/services/database.ts`
- [ ] Add prepared statements for repository operations
- [ ] Add database operations for:
  - [ ] Repositories CRUD
  - [ ] Branches CRUD
  - [ ] Commits CRUD
  - [ ] Pull Requests CRUD
  - [ ] PR Reviews CRUD
  - [ ] PR Labels CRUD
  - [ ] Tags CRUD
  - [ ] Releases CRUD
  - [ ] Contributors CRUD
  - [ ] Pull Request ↔ Commit mappings

### Phase 2: Backend Services

- [ ] Create `server/src/services/repositorySync.ts`:
  - [ ] `syncRepository()` - main sync orchestrator
  - [ ] `syncBranches()` - fetch branches and protection rules
  - [ ] `syncCommits()` - fetch and store commits (metadata only, link to source for diff)
  - [ ] `syncPullRequests()` - fetch PRs with reviews and labels
  - [ ] `syncTags()` - fetch tags
  - [ ] `syncReleases()` - fetch releases with assets
  - [ ] `findOrCreateContributor()` - author mapping
- [ ] Create `server/src/routes/repositories.ts`
- [ ] Create `server/src/routes/branches.ts` (optional, can be nested)
- [ ] Create `server/src/routes/tags.ts` (optional, can be nested)
- [ ] Register router in `server/src/index.ts`

### Phase 3: Frontend - App Shell

- [ ] Create `client/src/apps/repositories/` folder structure
- [ ] Implement `RepositoriesApp.tsx` with view tabs
- [ ] Implement `RepositoriesApp.module.css`
- [ ] Create barrel exports

### Phase 4: Frontend - Components

- [ ] `AddRepositoryModal` - select repos from integrations
- [ ] `RepositoryList` - list of tracked repos
- [ ] `CommitList` - paginated commit list
- [ ] `PullRequestList` - PR list with state filters
- [ ] `ContributorList` - contributor list

### Phase 5: Frontend - Sidekick Details

- [ ] `RepositoryDetail` with Overview, Commits, PRs tabs
- [ ] `CommitDetail` with diff viewer
- [ ] `PullRequestDetail` with commits list
- [ ] `ContributorDetail` with activity summary
- [ ] Update `Sidekick.tsx` to handle new item types

### Phase 6: Navigation & API

- [ ] Add API functions to `client/src/lib/api.ts`
- [ ] Update `SidekickItemType` in `appStore.ts`
- [ ] Add route to `App.tsx`
- [ ] Add nav item to `Appbar.tsx`
- [ ] Update `apps/index.ts` barrel export

### Phase 7: Polish

- [ ] Loading states and skeletons
- [ ] Error handling and toast messages
- [ ] Empty states with helpful actions
- [ ] Optimistic updates where appropriate
- [ ] Pagination for large lists

### Phase 8: Testing

- [ ] Unit tests for repository sync service
- [ ] API integration tests
- [ ] E2E test `e2e/repositories.spec.ts`:
  - [ ] Navigate to /repositories
  - [ ] Add repository from GitHub
  - [ ] Sync repository
  - [ ] View commits and PRs
  - [ ] Open commit diff
  - [ ] View contributor details

---

## Future Enhancements

1. **Commit Diff Storage** — Store actual diffs locally instead of linking to GitHub
2. **Webhooks** — Real-time updates via GitHub/GitLab webhooks instead of polling
3. **GitLab/Bitbucket Support** — Extend provider implementations
4. **Code Search** — Full-text search across diffs and file contents
4. **Activity Graphs** — Contribution heatmaps, burndown charts, velocity metrics
5. **Blame/History** — File-level history and line-by-line attribution
6. **Diff Comments** — Add internal notes/annotations to specific commits
7. **Background Sync** — Scheduled periodic syncing with configurable frequency
8. **Fork Tracking** — Track fork relationships and parent repos
9. **Language Breakdown** — Full language stats with byte counts
10. **Topics/Labels** — Repository topics and categorization
11. **License Detection** — Track repository licenses
12. **Commit Verification** — GPG signature verification status
13. **CI/CD Status** — Check runs and workflow status on PRs
14. **Linked Issues** — Parse and track issue references from PR bodies
15. **Merge Conflicts** — Detect and show mergeable state
16. **Dependency Tracking** — Parse package.json, requirements.txt, etc.
17. **Security Scanning** — Flag commits with potential secrets/vulnerabilities
18. **Issue Tracking** — Full issue sync
19. **Compare View** — Diff between two branches/commits/tags

