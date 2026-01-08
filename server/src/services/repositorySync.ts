/**
 * Repository Sync Service
 * Handles syncing commits, PRs, branches, etc. from source providers (GitHub, etc.)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Repository,
  Commit,
  PullRequest,
  Branch,
  Contributor,
  RepositorySyncResponse,
  PullRequestReview,
  PullRequestLabel,
  CommitStats,
} from '@machina/shared';
import { database } from './database';
import { decryptCredentials } from './credentialVault';

interface SyncOptions {
  repo: Repository;
  teamId: string;
  userId: string;
  syncCommits?: boolean;
  syncPrs?: boolean;
  forceFullSync?: boolean;
}

interface GitHubCommitListItem {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
  };
  committer?: {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
  parents: { sha: string }[];
}

interface GitHubCommitDetail extends GitHubCommitListItem {
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  files: {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    status: string;
  }[];
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  draft: boolean;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
    sha: string;
    repo?: {
      full_name: string;
    };
  };
  base: {
    ref: string;
    sha: string;
  };
  merged_at: string | null;
  merge_commit_sha: string | null;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  comments: number;
  review_comments: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: {
    name: string;
    color: string;
    description?: string;
  }[];
}

interface GitHubReview {
  id: number;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  state: string;
  body: string | null;
  submitted_at: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

class RepositorySyncService {
  /**
   * Get access token for a repository's integration
   */
  private async getAccessToken(repo: Repository): Promise<string> {
    if (!repo.source_integration_id) {
      throw new Error('Repository has no linked integration');
    }

    const integration = database.getTeamIntegrationById(repo.source_integration_id);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const encryptedCreds = database.getIntegrationCredentials(integration.integration_id);
    if (!encryptedCreds) {
      throw new Error('Integration credentials not found');
    }

    const creds = decryptCredentials(
      integration.team_id,
      integration.integration_id,
      encryptedCreds
    ) as { access_token: string };

    return creds.access_token;
  }

  /**
   * Make a GitHub API request with pagination support
   */
  private async githubFetch<T>(
    accessToken: string,
    endpoint: string,
    options: { perPage?: number; maxPages?: number } = {}
  ): Promise<T[]> {
    const { perPage = 100, maxPages = 10 } = options;
    const results: T[] = [];
    let page = 1;

    while (page <= maxPages) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `https://api.github.com${endpoint}${separator}per_page=${perPage}&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as T[];

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      results.push(...data);

      // Check for next page
      const linkHeader = response.headers.get('Link');
      if (!linkHeader || !linkHeader.includes('rel="next"')) {
        break;
      }

      page++;
    }

    return results;
  }

  /**
   * Fetch a single commit's details (includes stats and files)
   */
  private async fetchCommitDetail(
    accessToken: string,
    repoFullName: string,
    sha: string
  ): Promise<GitHubCommitDetail> {
    const url = `https://api.github.com/repos/${repoFullName}/commits/${sha}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as GitHubCommitDetail;
  }

  /**
   * Find or create a contributor for a commit/PR author
   */
  private findOrCreateContributor(
    teamId: string,
    email: string,
    name: string,
    externalAccount?: {
      source_type: 'github';
      external_id: string;
      username: string;
      avatar_url?: string;
      profile_url?: string;
    }
  ): Contributor {
    // Try to find by email
    let contributor = database.getContributorByEmail(teamId, email);

    if (contributor) {
      // Update external accounts if we have new info
      if (externalAccount) {
        const existingAccounts = contributor.external_accounts || [];
        const hasAccount = existingAccounts.some(
          (a) =>
            a.source_type === externalAccount.source_type &&
            a.external_id === externalAccount.external_id
        );

        if (!hasAccount) {
          database.updateContributor({
            contributor_id: contributor.contributor_id,
            external_accounts: [...existingAccounts, externalAccount],
            updated_at: new Date().toISOString(),
          });
          const updated = database.getContributor(contributor.contributor_id);
          if (updated) contributor = updated;
        }
      }
      return contributor;
    }

    // Create new contributor
    const now = new Date().toISOString();
    const newContributor: Contributor = {
      contributor_id: `ctr_${uuidv4().substring(0, 20)}`,
      team_id: teamId,
      name,
      email,
      emails: [email],
      external_accounts: externalAccount ? [externalAccount] : [],
      total_commits: 0,
      total_prs: 0,
      created_at: now,
      updated_at: now,
    };

    database.insertContributor(newContributor);
    return newContributor;
  }

  /**
   * Sync commits from GitHub
   */
  private async syncCommits(
    repo: Repository,
    accessToken: string,
    since?: string
  ): Promise<{ synced: number; contributorsCreated: number }> {
    let synced = 0;
    let contributorsCreated = 0;

    // Build endpoint with since parameter if provided
    let endpoint = `/repos/${repo.full_name}/commits`;
    if (since) {
      endpoint += `?since=${since}`;
    }

    // Fetch list of commits (doesn't include stats)
    const commitList = await this.githubFetch<GitHubCommitListItem>(accessToken, endpoint, {
      perPage: 100,
      maxPages: 20,
    });

    const now = new Date().toISOString();

    for (const listItem of commitList) {
      // Check if commit already exists - if so, skip entirely (never refetch)
      const existingCommit = database.getCommitBySha(repo.team_id, listItem.sha);
      if (existingCommit) {
        continue;
      }

      // Fetch individual commit details to get stats (additions, deletions, files)
      const ghCommit = await this.fetchCommitDetail(accessToken, repo.full_name, listItem.sha);

      // Find or create contributor
      const authorEmail = ghCommit.commit.author.email;
      const authorName = ghCommit.commit.author.name;

      let externalAccount;
      if (ghCommit.author) {
        externalAccount = {
          source_type: 'github' as const,
          external_id: String(ghCommit.author.id),
          username: ghCommit.author.login,
          avatar_url: ghCommit.author.avatar_url,
          profile_url: ghCommit.author.html_url,
        };
      }

      const existingContributor = database.getContributorByEmail(repo.team_id, authorEmail);

      if (!existingContributor) {
        contributorsCreated++;
      }

      const contributor = this.findOrCreateContributor(
        repo.team_id,
        authorEmail,
        authorName,
        externalAccount
      );

      // Use accurate stats from individual commit endpoint
      const stats: CommitStats = {
        additions: ghCommit.stats.additions,
        deletions: ghCommit.stats.deletions,
        files_changed: ghCommit.files.length,
      };

      const commit: Commit = {
        commit_id: `cmt_${uuidv4().substring(0, 20)}`,
        repo_id: repo.repo_id,
        team_id: repo.team_id,
        sha: ghCommit.sha,
        short_sha: ghCommit.sha.substring(0, 7),
        is_on_default_branch: true, // We're fetching from default branch
        contributor_id: contributor.contributor_id,
        author_name: authorName,
        author_email: authorEmail,
        authored_at: ghCommit.commit.author.date,
        committer_name: ghCommit.commit.committer.name,
        committer_email: ghCommit.commit.committer.email,
        committed_at: ghCommit.commit.committer.date,
        message: ghCommit.commit.message,
        message_headline: ghCommit.commit.message.split('\n')[0],
        stats,
        source_type: 'github',
        html_url: ghCommit.html_url,
        parent_shas: ghCommit.parents.map((p) => p.sha),
        is_merge_commit: ghCommit.parents.length > 1,
        synced_at: now,
      };

      database.insertCommit(commit);
      synced++;

      // Update contributor stats
      database.updateContributor({
        contributor_id: contributor.contributor_id,
        total_commits: (contributor.total_commits || 0) + 1,
        last_commit_at: ghCommit.commit.author.date,
        first_commit_at: contributor.first_commit_at || ghCommit.commit.author.date,
        updated_at: now,
      });
    }

    return { synced, contributorsCreated };
  }

  /**
   * Backfill stats for commits that are missing them (all zeros)
   */
  private async backfillCommitStats(repo: Repository, accessToken: string): Promise<number> {
    // Get all commits for this repo
    const commits = database.getCommits(repo.team_id, { repo_id: repo.repo_id });

    // Filter to only those with missing stats (all zeros)
    const commitsNeedingStats = commits.filter(
      (c) => c.stats.additions === 0 && c.stats.deletions === 0 && c.stats.files_changed === 0
    );

    if (commitsNeedingStats.length === 0) {
      return 0;
    }

    const now = new Date().toISOString();
    let updated = 0;

    // Limit to first 200 to avoid rate limits (GitHub allows 5000/hour)
    const toUpdate = commitsNeedingStats.slice(0, 200);

    for (const commit of toUpdate) {
      try {
        // Fetch individual commit details to get stats
        const ghCommit = await this.fetchCommitDetail(accessToken, repo.full_name, commit.sha);

        const stats: CommitStats = {
          additions: ghCommit.stats.additions,
          deletions: ghCommit.stats.deletions,
          files_changed: ghCommit.files.length,
        };

        // Update the commit with new stats
        const updatedCommit: Commit = {
          ...commit,
          stats,
          synced_at: now,
        };

        database.insertCommit(updatedCommit); // Uses ON CONFLICT to update
        updated++;
      } catch (error) {
        // Log and continue - don't fail the whole sync for one commit
        console.error(`Failed to fetch stats for commit ${commit.sha}:`, error);
      }
    }

    return updated;
  }

  /**
   * Sync pull requests from GitHub
   */
  private async syncPullRequests(
    repo: Repository,
    accessToken: string
  ): Promise<{ synced: number; contributorsCreated: number }> {
    let synced = 0;
    let contributorsCreated = 0;

    // Fetch all PRs (open, closed, merged)
    const prs = await this.githubFetch<GitHubPullRequest>(
      accessToken,
      `/repos/${repo.full_name}/pulls?state=all`,
      {
        perPage: 100,
        maxPages: 10,
      }
    );

    const now = new Date().toISOString();

    for (const ghPr of prs) {
      // Find or create contributor for PR author
      const authorEmail = `${ghPr.user.login}@users.noreply.github.com`;
      const authorName = ghPr.user.login;

      const externalAccount = {
        source_type: 'github' as const,
        external_id: String(ghPr.user.id),
        username: ghPr.user.login,
        avatar_url: ghPr.user.avatar_url,
      };

      const existingContributor = database.getContributorByEmail(repo.team_id, authorEmail);
      if (!existingContributor) {
        contributorsCreated++;
      }

      const contributor = this.findOrCreateContributor(
        repo.team_id,
        authorEmail,
        authorName,
        externalAccount
      );

      // Determine state
      let state: 'open' | 'merged' | 'closed' | 'draft' = 'open';
      if (ghPr.draft) {
        state = 'draft';
      } else if (ghPr.merged_at) {
        state = 'merged';
      } else if (ghPr.state === 'closed') {
        state = 'closed';
      }

      // Convert labels
      const labels: PullRequestLabel[] = ghPr.labels.map((l) => ({
        name: l.name,
        color: l.color,
        description: l.description,
      }));

      // Fetch reviews
      const reviews: PullRequestReview[] = [];
      try {
        const ghReviews = await this.githubFetch<GitHubReview>(
          accessToken,
          `/repos/${repo.full_name}/pulls/${ghPr.number}/reviews`,
          { perPage: 50, maxPages: 2 }
        );

        for (const ghReview of ghReviews) {
          const reviewerEmail = `${ghReview.user.login}@users.noreply.github.com`;
          const reviewer = this.findOrCreateContributor(
            repo.team_id,
            reviewerEmail,
            ghReview.user.login,
            {
              source_type: 'github',
              external_id: String(ghReview.user.id),
              username: ghReview.user.login,
              avatar_url: ghReview.user.avatar_url,
            }
          );

          reviews.push({
            review_id: `rev_${ghReview.id}`,
            pr_id: `pr_${ghPr.id}`,
            contributor_id: reviewer.contributor_id,
            reviewer_username: ghReview.user.login,
            reviewer_avatar_url: ghReview.user.avatar_url,
            state: ghReview.state.toLowerCase() as PullRequestReview['state'],
            body: ghReview.body || undefined,
            submitted_at: ghReview.submitted_at,
          });
        }
      } catch {
        // Reviews fetch failed, continue without reviews
      }

      // Determine review decision
      let reviewDecision: PullRequest['review_decision'] = undefined;
      if (reviews.length > 0) {
        const approvedReviews = reviews.filter((r) => r.state === 'approved');
        const changesRequested = reviews.filter((r) => r.state === 'changes_requested');
        if (approvedReviews.length > 0 && changesRequested.length === 0) {
          reviewDecision = 'approved';
        } else if (changesRequested.length > 0) {
          reviewDecision = 'changes_requested';
        } else {
          reviewDecision = 'review_required';
        }
      }

      const pr: PullRequest = {
        pr_id: `pr_${ghPr.id}`,
        repo_id: repo.repo_id,
        team_id: repo.team_id,
        number: ghPr.number,
        source_type: 'github',
        source_pr_id: String(ghPr.id),
        title: ghPr.title,
        body: ghPr.body || undefined,
        state,
        is_draft: ghPr.draft,
        contributor_id: contributor.contributor_id,
        author_username: ghPr.user.login,
        head_branch: ghPr.head.ref,
        head_sha: ghPr.head.sha,
        head_repo_full_name: ghPr.head.repo?.full_name,
        base_branch: ghPr.base.ref,
        base_sha: ghPr.base.sha,
        labels,
        reviews,
        review_decision: reviewDecision,
        merged_at: ghPr.merged_at || undefined,
        merge_commit_sha: ghPr.merge_commit_sha || undefined,
        commits_count: ghPr.commits,
        additions: ghPr.additions,
        deletions: ghPr.deletions,
        changed_files: ghPr.changed_files,
        comments_count: ghPr.comments,
        review_comments_count: ghPr.review_comments,
        html_url: ghPr.html_url,
        created_at: ghPr.created_at,
        updated_at: ghPr.updated_at,
        closed_at: ghPr.closed_at || undefined,
        synced_at: now,
      };

      database.insertPullRequest(pr);
      synced++;

      // Update contributor stats
      database.updateContributor({
        contributor_id: contributor.contributor_id,
        total_prs: (contributor.total_prs || 0) + 1,
        updated_at: now,
      });
    }

    return { synced, contributorsCreated };
  }

  /**
   * Sync branches from GitHub
   */
  private async syncBranches(repo: Repository, accessToken: string): Promise<number> {
    const branches = await this.githubFetch<GitHubBranch>(
      accessToken,
      `/repos/${repo.full_name}/branches`,
      {
        perPage: 100,
        maxPages: 5,
      }
    );

    const now = new Date().toISOString();
    let synced = 0;

    for (const ghBranch of branches) {
      const branch: Branch = {
        branch_id: `br_${uuidv4().substring(0, 20)}`,
        repo_id: repo.repo_id,
        team_id: repo.team_id,
        name: ghBranch.name,
        sha: ghBranch.commit.sha,
        is_default: ghBranch.name === repo.default_branch,
        is_protected: ghBranch.protected,
        ahead_of_default: 0,
        behind_default: 0,
        synced_at: now,
      };

      database.upsertBranch(branch);
      synced++;
    }

    return synced;
  }

  /**
   * Main sync function
   */
  async syncRepository(options: SyncOptions): Promise<RepositorySyncResponse> {
    const { repo, syncCommits = true, syncPrs = true, forceFullSync = false } = options;

    const startedAt = new Date().toISOString();
    let commitsSynced = 0;
    let prsSynced = 0;
    let contributorsCreated = 0;

    try {
      // Update sync status
      database.updateRepository({
        repo_id: repo.repo_id,
        sync_status: 'syncing',
        updated_at: startedAt,
      });

      // Get access token
      const accessToken = await this.getAccessToken(repo);

      // Sync branches first
      const branchesSynced = await this.syncBranches(repo, accessToken);

      // Sync commits
      if (syncCommits) {
        const since = forceFullSync ? undefined : repo.last_sync_at || repo.tracking_since;
        const result = await this.syncCommits(repo, accessToken, since);
        commitsSynced = result.synced;
        contributorsCreated += result.contributorsCreated;
      }

      // Sync PRs
      if (syncPrs) {
        const result = await this.syncPullRequests(repo, accessToken);
        prsSynced = result.synced;
        contributorsCreated += result.contributorsCreated;
      }

      const finishedAt = new Date().toISOString();

      // Update repository with sync results
      database.updateRepository({
        repo_id: repo.repo_id,
        sync_status: 'synced',
        last_sync_at: finishedAt,
        last_sync_error: undefined,
        commits_synced_count: repo.commits_synced_count + commitsSynced,
        prs_synced_count: repo.prs_synced_count + prsSynced,
        branches_synced_count: branchesSynced,
        updated_at: finishedAt,
      });

      return {
        success: true,
        repo_id: repo.repo_id,
        commits_synced: commitsSynced,
        prs_synced: prsSynced,
        contributors_created: contributorsCreated,
        started_at: startedAt,
        finished_at: finishedAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';

      // Update repository with error
      database.updateRepository({
        repo_id: repo.repo_id,
        sync_status: 'error',
        last_sync_error: errorMessage,
        updated_at: new Date().toISOString(),
      });

      return {
        success: false,
        repo_id: repo.repo_id,
        commits_synced: commitsSynced,
        prs_synced: prsSynced,
        contributors_created: contributorsCreated,
        started_at: startedAt,
        error: errorMessage,
      };
    }
  }
}

export const repositorySyncService = new RepositorySyncService();
