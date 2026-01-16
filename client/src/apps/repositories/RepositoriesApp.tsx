import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderGit2,
  GitCommit,
  GitPullRequest,
  Users,
  Plus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type {
  RepositorySyncStatus,
  RepositoryWithStats,
  CommitWithRepo,
  PullRequestWithDetails,
  Contributor,
} from '@machina/shared';
import {
  getRepositories,
  getCommits,
  getPullRequests,
  getContributors,
  syncAllRepositories,
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, RefreshButton } from '@/shared/ui';
import {
  Page,
  PageEmptyState,
  PageList,
  ItemCard,
  ItemCardMeta,
  ItemCardStatus,
  ItemCardBadge,
  CollapsibleGroup,
} from '@/shared';
import { AddRepositoryModal } from './components';
import styles from './RepositoriesApp.module.css';

type ViewMode = 'repositories' | 'commits' | 'pull-requests' | 'contributors';

export function RepositoriesApp() {
  const { setSidekickSelection, sidekickSelection, addToast } = useAppStore();
  const { currentTeamId, getCurrentTeam } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('repositories');
  const [showAddModal, setShowAddModal] = useState(false);

  const currentTeamRole = getCurrentTeam()?.role;

  const { data: repositories, isLoading: reposLoading } = useQuery({
    queryKey: ['repositories', currentTeamId],
    queryFn: () => getRepositories(),
  });

  const { data: commits, isLoading: commitsLoading } = useQuery({
    queryKey: ['commits', currentTeamId],
    queryFn: () => getCommits(),
    enabled: viewMode === 'commits',
  });

  const { data: pullRequests, isLoading: prsLoading } = useQuery({
    queryKey: ['pull-requests', currentTeamId],
    queryFn: () => getPullRequests(),
    enabled: viewMode === 'pull-requests',
  });

  const { data: contributors, isLoading: contributorsLoading } = useQuery({
    queryKey: ['contributors', currentTeamId],
    queryFn: () => getContributors(),
    enabled: viewMode === 'contributors',
  });

  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: syncAllRepositories,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['repositories', currentTeamId] });

      // Snapshot the previous value
      const previousRepositories = queryClient.getQueryData<RepositoryWithStats[]>(['repositories', currentTeamId]);

      // Optimistically update all repositories to syncing status
      queryClient.setQueryData(
        ['repositories', currentTeamId],
        (old: RepositoryWithStats[] | undefined) =>
          old?.map((repo) => ({ ...repo, sync_status: 'syncing' as const }))
      );

      // Also update any individual repository queries that might be open in sidekick
      previousRepositories?.forEach((repo) => {
        queryClient.setQueryData(
          ['repository', repo.repo_id],
          (old: RepositoryWithStats | undefined) =>
            old ? { ...old, sync_status: 'syncing' as const } : old
        );
      });

      return { previousRepositories };
    },
    onSuccess: (data) => {
      // Invalidate all repository-related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['repositories', currentTeamId] });
      queryClient.invalidateQueries({ queryKey: ['commits', currentTeamId] });
      queryClient.invalidateQueries({ queryKey: ['pull-requests', currentTeamId] });
      queryClient.invalidateQueries({ queryKey: ['contributors', currentTeamId] });
      // Invalidate all individual repository queries
      repositories?.forEach((repo) => {
        queryClient.invalidateQueries({ queryKey: ['repository', repo.repo_id] });
        queryClient.invalidateQueries({ queryKey: ['repository-commits', repo.repo_id] });
      });
      
      addToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synced ${data.total_commits_synced} commits and ${data.total_prs_synced} PRs from ${data.synced_repos} repositories`,
      });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousRepositories) {
        queryClient.setQueryData(['repositories', currentTeamId], context.previousRepositories);
        // Also rollback individual repository queries
        context.previousRepositories.forEach((repo) => {
          queryClient.setQueryData(['repository', repo.repo_id], repo);
        });
      }
      addToast({
        type: 'error',
        title: 'Sync Failed',
        message: error.message,
      });
    },
  });

  const isAdmin = currentTeamRole === 'admin';
  const repoCount = repositories?.length ?? 0;

  const getSyncStatusVariant = (
    status: RepositorySyncStatus
  ): 'valid' | 'muted' | 'warning' | 'invalid' => {
    switch (status) {
      case 'synced':
        return 'valid';
      case 'syncing':
        return 'warning';
      case 'error':
        return 'invalid';
      default:
        return 'muted';
    }
  };

  const isLoading =
    viewMode === 'repositories'
      ? reposLoading
      : viewMode === 'commits'
        ? commitsLoading
        : viewMode === 'pull-requests'
          ? prsLoading
          : contributorsLoading;

  return (
    <Page
      title="Repositories"
      count={repoCount}
      isLoading={isLoading}
      actions={
        <>
          <div className={styles['viewTabs']}>
            <button
              className={`${styles['viewTab']} ${viewMode === 'repositories' ? styles['viewTabActive'] : ''}`}
              onClick={() => setViewMode('repositories')}
            >
              <FolderGit2 size={14} />
              Repos
            </button>
            <button
              className={`${styles['viewTab']} ${viewMode === 'commits' ? styles['viewTabActive'] : ''}`}
              onClick={() => setViewMode('commits')}
            >
              <GitCommit size={14} />
              Commits
            </button>
            <button
              className={`${styles['viewTab']} ${viewMode === 'pull-requests' ? styles['viewTabActive'] : ''}`}
              onClick={() => setViewMode('pull-requests')}
            >
              <GitPullRequest size={14} />
              PRs
            </button>
            <button
              className={`${styles['viewTab']} ${viewMode === 'contributors' ? styles['viewTabActive'] : ''}`}
              onClick={() => setViewMode('contributors')}
            >
              <Users size={14} />
              Contributors
            </button>
          </div>
          <RefreshButton
            onRefresh={() => syncMutation.mutate()}
            isRefreshing={syncMutation.isPending}
            title="Sync all repositories"
          />
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
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
                <RepositoryItem
                  key={repo.repo_id}
                  repo={repo}
                  onSelect={() => setSidekickSelection({ type: 'repository', id: repo.repo_id })}
                  getSyncStatusVariant={getSyncStatusVariant}
                  isSelected={
                    sidekickSelection?.type === 'repository' &&
                    sidekickSelection?.id === repo.repo_id
                  }
                />
              ))}
            </PageList>
          ) : (
            <PageEmptyState
              title="No repositories tracked"
              description="Add repositories from your connected integrations to start tracking commits and pull requests."
              actions={
                isAdmin ? (
                  <Button variant="primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={14} />
                    Add Repository
                  </Button>
                ) : undefined
              }
            />
          )}
        </>
      )}

      {viewMode === 'commits' && <CommitListView commits={commits || []} />}

      {viewMode === 'pull-requests' && <PullRequestListView pullRequests={pullRequests || []} />}

      {viewMode === 'contributors' && <ContributorListView contributors={contributors || []} />}

      {showAddModal && <AddRepositoryModal onClose={() => setShowAddModal(false)} />}
    </Page>
  );
}

// Repository Item Component
interface RepositoryItemProps {
  repo: RepositoryWithStats;
  onSelect: () => void;
  getSyncStatusVariant: (status: RepositorySyncStatus) => 'valid' | 'muted' | 'warning' | 'invalid';
  isSelected: boolean;
}

function RepositoryItem({ repo, onSelect, getSyncStatusVariant, isSelected }: RepositoryItemProps) {
  // Split full_name into org and repo parts (e.g., "cypher-agi/machina")
  const [orgName, repoName] = repo.full_name.includes('/')
    ? repo.full_name.split('/')
    : ['', repo.full_name];

  return (
    <ItemCard
      iconBadge={<FolderGit2 size={14} />}
      title={
        orgName ? (
          <>
            <span className={styles['repoOrg']}>{orgName}/</span>
            <span className={styles['repoName']}>{repoName}</span>
          </>
        ) : (
          <span className={styles['repoName']}>{repoName}</span>
        )
      }
      titleSans
      selected={isSelected}
      onClick={onSelect}
      statusBadge={
        <ItemCardStatus variant={getSyncStatusVariant(repo.sync_status)}>
          {repo.sync_status === 'syncing' ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Syncing...
            </>
          ) : repo.sync_status === 'synced' ? (
            'Synced'
          ) : repo.sync_status === 'error' ? (
            'Error'
          ) : (
            'Idle'
          )}
        </ItemCardStatus>
      }
      meta={
        <>
          {repo.description && <ItemCardMeta>{repo.description}</ItemCardMeta>}
          <ItemCardMeta>
            {repo.commits_synced_count} commits • {repo.prs_synced_count} PRs
            {repo.last_sync_at && (
              <>
                {' '}
                • Last synced{' '}
                {formatDistanceToNow(new Date(repo.last_sync_at), { addSuffix: true })}
              </>
            )}
          </ItemCardMeta>
        </>
      }
      badges={
        <>
          <ItemCardBadge>{repo.source_type}</ItemCardBadge>
          <ItemCardBadge>{repo.default_branch}</ItemCardBadge>
          {repo.is_private && <ItemCardBadge>private</ItemCardBadge>}
          {repo.primary_language && <ItemCardBadge>{repo.primary_language}</ItemCardBadge>}
          {repo.contributor_count > 0 && (
            <ItemCardBadge>{repo.contributor_count} contributors</ItemCardBadge>
          )}
        </>
      }
    />
  );
}

// Parse conventional commit type from message
function parseCommitType(message: string): { type: string | null; message: string } {
  // Match patterns like "feat:", "fix(scope):", "chore!:", etc.
  const match = message.match(/^(\w+)(?:\([^)]+\))?!?:\s*/);
  if (match && match[1]) {
    const type = match[1].toLowerCase();
    const knownTypes = [
      'feat',
      'fix',
      'chore',
      'docs',
      'style',
      'refactor',
      'test',
      'perf',
      'ci',
      'build',
      'revert',
      'wip',
    ];
    if (knownTypes.includes(type)) {
      return { type, message: message.slice(match[0].length) };
    }
  }
  return { type: null, message };
}

// Get commit type styling
function getCommitTypeClass(type: string): string {
  const classMap: Record<string, string> = {
    feat: styles['commitTypeFeat'] ?? '',
    fix: styles['commitTypeFix'] ?? '',
    docs: styles['commitTypeDocs'] ?? '',
    refactor: styles['commitTypeRefactor'] ?? '',
    test: styles['commitTypeTest'] ?? '',
    perf: styles['commitTypePerf'] ?? '',
    chore: styles['commitTypeChore'] ?? '',
    ci: styles['commitTypeChore'] ?? '',
    build: styles['commitTypeChore'] ?? '',
    revert: styles['commitTypeRevert'] ?? '',
    wip: styles['commitTypeWip'] ?? '',
    style: styles['commitTypeChore'] ?? '',
  };
  return classMap[type] ?? styles['commitTypeDefault'] ?? '';
}

// Group stats interface
interface DateGroupStats {
  commits: CommitWithRepo[];
  totalFilesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
}

// Commit List View - Readable list format
function CommitListView({ commits }: { commits: CommitWithRepo[] }) {
  const { setSidekickSelection, sidekickSelection } = useAppStore();

  if (commits.length === 0) {
    return (
      <PageEmptyState
        title="No commits synced"
        description="Sync a repository to see commits here."
      />
    );
  }

  // Sort commits by authored_at descending (most recent first)
  const sortedCommits = [...commits].sort(
    (a, b) => new Date(b.authored_at).getTime() - new Date(a.authored_at).getTime()
  );

  // Group commits by date with aggregated stats
  const groupedByDate: Record<string, DateGroupStats> = sortedCommits.reduce(
    (groups, commit) => {
      const date = new Date(commit.authored_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[date]) {
        groups[date] = {
          commits: [],
          totalFilesChanged: 0,
          totalAdditions: 0,
          totalDeletions: 0,
        };
      }
      groups[date].commits.push(commit);
      groups[date].totalFilesChanged += commit.stats.files_changed || 0;
      groups[date].totalAdditions += commit.stats.additions || 0;
      groups[date].totalDeletions += commit.stats.deletions || 0;
      return groups;
    },
    {} as Record<string, DateGroupStats>
  );

  return (
    <div className={styles['commitsList']}>
      {Object.entries(groupedByDate).map(([date, groupStats]) => (
        <CollapsibleGroup
          key={date}
          label={date}
          stats={
            <>
              {groupStats.totalFilesChanged > 0 && (
                <span className={styles['commitsDateFilesChanged']}>
                  {groupStats.totalFilesChanged} file{groupStats.totalFilesChanged !== 1 ? 's' : ''}
                </span>
              )}
              {groupStats.totalAdditions > 0 && (
                <span className={styles['commitsDateAdditions']}>
                  +{groupStats.totalAdditions.toLocaleString()}
                </span>
              )}
              {groupStats.totalDeletions > 0 && (
                <span className={styles['commitsDateDeletions']}>
                  -{groupStats.totalDeletions.toLocaleString()}
                </span>
              )}
            </>
          }
        >
          <div className={styles['commitsDateList']}>
            {groupStats.commits.map((commit) => {
              const { type, message } = parseCommitType(commit.message_headline);
              const isSelected =
                sidekickSelection?.type === 'commit' && sidekickSelection?.id === commit.commit_id;
              return (
                <div
                  key={commit.commit_id}
                  className={`${styles['commitItem']} ${isSelected ? styles['commitItemSelected'] : ''}`}
                  onClick={() => setSidekickSelection({ type: 'commit', id: commit.commit_id })}
                >
                  <div className={styles['commitIcon']}>
                    <GitCommit size={16} />
                  </div>
                  <div className={styles['commitAvatar']}>
                    {commit.contributor?.avatar_url ? (
                      <img
                        src={commit.contributor.avatar_url}
                        alt={commit.author_name}
                        className={styles['commitAvatarImg']}
                      />
                    ) : (
                      <span className={styles['commitAvatarFallback']}>
                        {commit.author_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={styles['commitContent']}>
                    <div className={styles['commitHeader']}>
                      {type && (
                        <span className={`${styles['commitType']} ${getCommitTypeClass(type)}`}>
                          {type}
                        </span>
                      )}
                      <span className={styles['commitMessage']}>{message}</span>
                      {commit.is_merge_commit && (
                        <span className={styles['commitMergeBadge']}>merge</span>
                      )}
                    </div>
                    <div className={styles['commitMeta']}>
                      <span className={styles['commitSha']}>{commit.short_sha}</span>
                      <span className={styles['commitSep']}>·</span>
                      <span className={styles['commitRepo']}>
                        {commit.repository.full_name.includes('/') ? (
                          <>
                            <span className={styles['repoOrg']}>
                              {commit.repository.full_name.split('/')[0]}/
                            </span>
                            <span className={styles['repoNameWhite']}>
                              {commit.repository.full_name.split('/')[1]}
                            </span>
                          </>
                        ) : (
                          <span className={styles['repoNameWhite']}>
                            {commit.repository.full_name}
                          </span>
                        )}
                      </span>
                      <span className={styles['commitSep']}>·</span>
                      <span className={styles['commitAuthor']}>{commit.author_name}</span>
                      <span className={styles['commitSep']}>·</span>
                      <span className={styles['commitTime']}>
                        {formatDistanceToNow(new Date(commit.authored_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className={styles['commitStats']}>
                    {commit.stats.files_changed > 0 && (
                      <span className={styles['commitFilesChanged']}>
                        {commit.stats.files_changed} file
                        {commit.stats.files_changed !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={styles['commitAdditions']}>
                      +{commit.stats.additions.toLocaleString()}
                    </span>
                    <span className={styles['commitDeletions']}>
                      -{commit.stats.deletions.toLocaleString()}
                    </span>
                  </div>
                  <button
                    className={styles['commitLink']}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(commit.html_url, '_blank');
                    }}
                    title="View on GitHub"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </CollapsibleGroup>
      ))}
    </div>
  );
}

// Pull Request List View - Readable list format
function PullRequestListView({ pullRequests }: { pullRequests: PullRequestWithDetails[] }) {
  const { setSidekickSelection, sidekickSelection } = useAppStore();

  if (pullRequests.length === 0) {
    return (
      <PageEmptyState
        title="No pull requests synced"
        description="Sync a repository to see pull requests here."
      />
    );
  }

  const getStateClass = (state: string) => {
    switch (state) {
      case 'open':
        return styles['prStateOpen'];
      case 'merged':
        return styles['prStateMerged'];
      case 'closed':
        return styles['prStateClosed'];
      default:
        return '';
    }
  };

  // Sort PRs by created_at descending (most recent first)
  const sortedPRs = [...pullRequests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className={styles['prsList']}>
      {sortedPRs.map((pr) => {
        const isSelected =
          sidekickSelection?.type === 'pull_request' && sidekickSelection?.id === pr.pr_id;
        return (
          <div
            key={pr.pr_id}
            className={`${styles['prItem']} ${isSelected ? styles['prItemSelected'] : ''}`}
            onClick={() => setSidekickSelection({ type: 'pull_request', id: pr.pr_id })}
          >
            <div className={styles['prIcon']}>
              <GitPullRequest size={16} />
            </div>
            <div className={styles['prContent']}>
              <div className={styles['prHeader']}>
                <span className={styles['prTitle']}>{pr.title}</span>
                <span className={`${styles['prStateBadge']} ${getStateClass(pr.state)}`}>
                  {pr.state}
                </span>
                {pr.is_draft && <span className={styles['prDraftBadge']}>draft</span>}
              </div>
              <div className={styles['prMeta']}>
                <span className={styles['prNumber']}>#{pr.number}</span>
                <span className={styles['prSep']}>·</span>
                <span className={styles['prRepo']}>
                  {pr.repository.full_name.includes('/') ? (
                    <>
                      <span className={styles['repoOrg']}>
                        {pr.repository.full_name.split('/')[0]}/
                      </span>
                      <span className={styles['repoNameWhite']}>
                        {pr.repository.full_name.split('/')[1]}
                      </span>
                    </>
                  ) : (
                    <span className={styles['repoNameWhite']}>{pr.repository.full_name}</span>
                  )}
                </span>
                <span className={styles['prSep']}>·</span>
                <span className={styles['prAuthor']}>by {pr.author_username}</span>
                <span className={styles['prSep']}>·</span>
                <span className={styles['prTime']}>
                  {formatDistanceToNow(new Date(pr.created_at), { addSuffix: true })}
                </span>
              </div>
              {pr.labels.length > 0 && (
                <div className={styles['prLabels']}>
                  {pr.labels.map((label: { name: string; color: string }) => (
                    <span
                      key={label.name}
                      className={styles['prLabelBadge']}
                      style={{
                        backgroundColor: `#${label.color}20`,
                        color: `#${label.color}`,
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles['prStats']}>
              <span className={styles['prAdditions']}>+{pr.additions}</span>
              <span className={styles['prDeletions']}>-{pr.deletions}</span>
              <span className={styles['prCommitCount']}>{pr.commits_count} commits</span>
            </div>
            <button
              className={styles['prLink']}
              onClick={(e) => {
                e.stopPropagation();
                window.open(pr.html_url, '_blank');
              }}
              title="View on GitHub"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Contributor List View - Readable list format
function ContributorListView({ contributors }: { contributors: Contributor[] }) {
  const { setSidekickSelection, sidekickSelection } = useAppStore();

  if (contributors.length === 0) {
    return (
      <PageEmptyState
        title="No contributors found"
        description="Sync a repository to see contributors here."
      />
    );
  }

  // Sort contributors by total commits descending
  const sortedContributors = [...contributors].sort((a, b) => b.total_commits - a.total_commits);

  return (
    <div className={styles['contributorsList']}>
      {sortedContributors.map((contributor) => {
        const avatarUrl = contributor.external_accounts[0]?.avatar_url;
        const initials = contributor.name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        const isSelected =
          sidekickSelection?.type === 'contributor' &&
          sidekickSelection?.id === contributor.contributor_id;

        return (
          <div
            key={contributor.contributor_id}
            className={`${styles['contributorItem']} ${isSelected ? styles['contributorItemSelected'] : ''}`}
            onClick={() =>
              setSidekickSelection({ type: 'contributor', id: contributor.contributor_id })
            }
          >
            <div className={styles['contributorAvatar']}>
              {avatarUrl ? <img src={avatarUrl} alt={contributor.name} /> : initials}
            </div>
            <div className={styles['contributorContent']}>
              <div className={styles['contributorHeader']}>
                <span className={styles['contributorName']}>{contributor.name}</span>
                {contributor.team_member_id ? (
                  <span className={styles['contributorTeamBadge']}>team member</span>
                ) : (
                  <span className={styles['contributorExternalBadge']}>external</span>
                )}
              </div>
              <div className={styles['contributorMeta']}>
                <span className={styles['contributorEmail']}>{contributor.email}</span>
                {contributor.last_commit_at && (
                  <>
                    <span className={styles['contributorSep']}>·</span>
                    <span className={styles['contributorLastActive']}>
                      Active{' '}
                      {formatDistanceToNow(new Date(contributor.last_commit_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className={styles['contributorStats']}>
              <div className={styles['contributorStatItem']}>
                <span className={styles['contributorStatValue']}>{contributor.total_commits}</span>
                <span className={styles['contributorStatLabel']}>commits</span>
              </div>
              <div className={styles['contributorStatItem']}>
                <span className={styles['contributorStatValue']}>{contributor.total_prs}</span>
                <span className={styles['contributorStatLabel']}>PRs</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
