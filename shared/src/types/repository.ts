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
  source_integration_id?: string; // Link to team_integrations if synced
  source_repo_id: string; // External ID (e.g., GitHub repo_id as string)

  // Organization/Owner
  owner_type: 'organization' | 'user';
  owner_name: string; // Organization or user name
  owner_id?: string; // External owner ID
  owner_avatar_url?: string;

  // Repository metadata
  name: string;
  full_name: string; // e.g., "org/repo-name"
  description?: string;
  url: string; // Web URL to repository
  clone_url?: string; // Git clone URL
  ssh_url?: string; // SSH clone URL
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
  is_tracking: boolean; // Whether to sync commits/PRs
  tracking_since?: string; // Only sync commits after this date
  tracked_branches: string[]; // Branches to track (empty = all/default only)

  // Sync state
  sync_status: RepositorySyncStatus;
  last_sync_at?: string;
  last_sync_error?: string;
  commits_synced_count: number;
  prs_synced_count: number;
  branches_synced_count: number;

  // Timestamps
  created_at_source: string; // When repo was created on GitHub/etc
  pushed_at_source?: string; // Last push on source
  added_at: string; // When added to Repositories app
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
  name: string; // e.g., "main", "feature/foo"

  // State
  sha: string; // Current HEAD commit SHA
  is_default: boolean;
  is_protected: boolean;

  // Protection rules (if protected)
  protection_rules?: BranchProtectionRules;

  // Stats
  ahead_of_default: number; // Commits ahead of default branch
  behind_default: number; // Commits behind default branch

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
  recent_commit_count: number; // Last 30 days
  open_pr_count: number;
}

// ============ Contributor ============

/**
 * External account linkage for a contributor
 */
export interface ContributorExternalAccount {
  source_type: SourceType;
  external_id: string; // GitHub user_id, GitLab user_id, etc.
  username: string; // GitHub login, GitLab username
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
  name: string; // From commit author name
  email: string; // Primary email (from commits)
  emails: string[]; // All known emails

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
  sha: string; // Full commit SHA
  short_sha: string; // First 7 chars

  // Branch context
  branch_name?: string; // Branch this commit was made on (if known)
  is_on_default_branch: boolean; // Is this on the default branch?

  // Author info
  contributor_id: string;
  author_name: string; // Raw author name from commit
  author_email: string; // Raw author email from commit
  authored_at: string; // When the commit was authored

  // Committer info (may differ from author)
  committer_name?: string;
  committer_email?: string;
  committed_at: string; // When the commit was committed

  // Commit content
  message: string; // Full commit message
  message_headline: string; // First line of message

  // Stats
  stats: CommitStats;

  // Source info
  source_type: SourceType;
  html_url: string; // URL to view commit and diff on GitHub/GitLab

  // Relationships
  parent_shas: string[]; // Parent commit SHAs
  pr_numbers?: number[]; // Associated PR numbers
  tag_names?: string[]; // Tags pointing to this commit

  // Metadata
  is_merge_commit: boolean;

  synced_at: string; // When we synced this commit
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
export type PullRequestReviewState =
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'pending'
  | 'dismissed';

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
  color: string; // Hex color without #
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
  number: number; // PR number in the repo
  source_type: SourceType;
  source_pr_id: string; // External ID

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
  head_branch: string; // Source branch
  head_sha: string; // Latest commit SHA on head
  head_repo_full_name?: string; // For cross-repo PRs (forks)
  base_branch: string; // Target branch
  base_sha: string; // Base commit SHA

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
  created_at: string; // When PR was opened
  updated_at: string; // Last activity
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
  name: string; // e.g., "v1.2.3"
  sha: string; // Commit SHA this tag points to

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
  tag_name: string; // Associated tag
  name: string; // Release title

  // Content
  body?: string; // Release notes (markdown)
  body_html?: string; // Rendered HTML

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
  since?: string; // ISO date
  until?: string; // ISO date
  search?: string; // Search message
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
  tracking_since?: string; // Optional: only sync commits after this date
}

export interface AddRepositoryFromGitHubRequest {
  github_repo_ids: string[]; // IDs from github_repositories table
  tracking_since?: string;
}

// ============ Sync Types ============

export interface RepositorySyncRequest {
  repo_id: string;
  sync_commits?: boolean; // Default true
  sync_prs?: boolean; // Default true
  force_full_sync?: boolean; // Re-sync all history
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
