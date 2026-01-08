import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
  ApiResponse,
  Repository,
  RepositoryWithStats,
  CommitWithRepo,
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
    const teamId = req.teamId as string;
    const filter: RepositoryListFilter = {
      search: req.query.search as string,
      source_type: req.query.source_type as RepositoryListFilter['source_type'],
      is_tracking:
        req.query.is_tracking === 'true'
          ? true
          : req.query.is_tracking === 'false'
            ? false
            : undefined,
      sync_status: req.query.sync_status as RepositoryListFilter['sync_status'],
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

// ============ Contributors (MUST be before /:id routes) ============

// GET /repositories/contributors - List all contributors
repositoriesRouter.get('/contributors', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
    const filter: ContributorListFilter = {
      search: req.query.search as string,
      has_team_member:
        req.query.has_team_member === 'true'
          ? true
          : req.query.has_team_member === 'false'
            ? false
            : undefined,
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

// GET /repositories/contributors/:id - Get contributor details
repositoriesRouter.get('/contributors/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
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
});

// POST /repositories/contributors/:id/link-member - Link contributor to team member
repositoriesRouter.post(
  '/contributors/:id/link-member',
  requireTeamAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId as string;
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

      const response: ApiResponse<Contributor | null> = {
        success: true,
        data: updated,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /repositories/contributors/:id/commits - Get commits by contributor
repositoriesRouter.get(
  '/contributors/:id/commits',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId as string;
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

// GET /repositories/contributors/:id/pull-requests - Get PRs by contributor
repositoriesRouter.get(
  '/contributors/:id/pull-requests',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId as string;
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

// ============ Global Commits (MUST be before /:id routes) ============

// GET /repositories/commits - List all commits across all repos
repositoriesRouter.get('/commits', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
    const filter: CommitListFilter = {
      repo_id: req.query.repo_id as string,
      contributor_id: req.query.contributor_id as string,
      since: req.query.since as string,
      until: req.query.until as string,
      search: req.query.search as string,
      branch: req.query.branch as string,
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

// GET /repositories/commits/:id - Get commit by ID or SHA
repositoriesRouter.get('/commits/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
    const { id } = req.params;

    // Try by commit_id first (cmt_ prefix), fall back to SHA lookup
    const commit = id.startsWith('cmt_')
      ? database.getCommitById(teamId, id)
      : database.getCommitBySha(teamId, id);

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

// ============ Global Pull Requests (MUST be before /:id routes) ============

// GET /repositories/pull-requests - List all PRs across all repos
repositoriesRouter.get('/pull-requests', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
    const filter: PullRequestListFilter = {
      repo_id: req.query.repo_id as string,
      contributor_id: req.query.contributor_id as string,
      state: req.query.state as PullRequestListFilter['state'],
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

// GET /repositories/pull-requests/:id - Get PR by ID
repositoriesRouter.get('/pull-requests/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
    const { id } = req.params;

    const pr = database.getPullRequest(id, teamId);
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
});

// GET /repositories/pull-requests/:id/commits - Get commits for a PR
repositoriesRouter.get(
  '/pull-requests/:id/commits',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId as string;
      const { id } = req.params;

      const pr = database.getPullRequest(id, teamId);
      if (!pr) {
        throw new AppError(404, 'NOT_FOUND', 'Pull request not found');
      }

      // Get commits associated with this PR
      const commits = database.getPullRequestCommits(id);

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

// ============ Repository CRUD (/:id routes AFTER static routes) ============

// GET /repositories/:id - Get repository details
repositoriesRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
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
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const teamId = req.teamId as string;
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
          teamId,
          'github',
          String(githubRepo.github_repo_id)
        );
        if (existing) {
          continue; // Already tracked
        }

        // Parse owner from full_name (format: owner/repo)
        const [ownerName] = githubRepo.full_name.split('/');

        // Create repository record
        const repo: Repository = {
          repo_id: `repo_${uuidv4().substring(0, 20)}`,
          team_id: teamId,
          source_type: 'github',
          source_integration_id: githubRepo.integration_id,
          source_repo_id: String(githubRepo.github_repo_id),
          owner_type: 'organization', // Default assumption
          owner_name: ownerName,
          name: githubRepo.name,
          full_name: githubRepo.full_name,
          description: githubRepo.description,
          url: githubRepo.html_url,
          clone_url: `${githubRepo.html_url}.git`,
          default_branch: githubRepo.default_branch,
          is_private: githubRepo.private,
          is_archived: githubRepo.archived,
          primary_language: githubRepo.language,
          stargazers_count: githubRepo.stargazers_count,
          forks_count: githubRepo.forks_count,
          open_issues_count: githubRepo.open_issues_count,
          is_tracking: true,
          tracking_since,
          tracked_branches: [],
          sync_status: 'idle',
          commits_synced_count: 0,
          prs_synced_count: 0,
          branches_synced_count: 0,
          created_at_source: now, // We don't have this from the GitHub repo table
          pushed_at_source: githubRepo.pushed_at,
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
      const teamId = req.teamId as string;
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
      const teamId = req.teamId as string;
      const userId = (req.user as { user_id: string }).user_id;
      const { id } = req.params;
      const {
        sync_commits = true,
        sync_prs = true,
        force_full_sync = false,
      }: Partial<RepositorySyncRequest> = req.body;

      const repo = database.getRepository(id, teamId);
      if (!repo) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }

      // Start sync
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
      const teamId = req.teamId as string;
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

      const response: ApiResponse<Repository | null> = {
        success: true,
        data: updated,
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
    const teamId = req.teamId as string;
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

// ============ Pull Requests ============

// GET /repositories/:id/pull-requests - List PRs for a repository
repositoriesRouter.get('/:id/pull-requests', (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.teamId as string;
    const { id } = req.params;
    const filter: PullRequestListFilter = {
      repo_id: id,
      contributor_id: req.query.contributor_id as string,
      state: req.query.state as PullRequestListFilter['state'],
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
});
