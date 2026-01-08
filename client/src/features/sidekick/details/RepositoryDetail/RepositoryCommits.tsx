import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCommit, ExternalLink, User, ChevronDown } from 'lucide-react';
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  isAfter,
  subWeeks,
  subMonths,
} from 'date-fns';
import clsx from 'clsx';
import type { CommitWithRepo } from '@machina/shared';
import { getRepositoryCommits } from '@/lib/api';
import { Button } from '@/shared/ui';
import { SidekickPanel, SidekickLoading } from '../../components';
import styles from './RepositoryDetail.module.css';

interface RepositoryCommitsProps {
  repositoryId: string;
}

type DateGroup =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'older';

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  older: 'Older',
};

const DATE_GROUP_ORDER: DateGroup[] = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'older',
];

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();

  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'thisWeek';
  if (isAfter(date, subWeeks(now, 2)) && !isThisWeek(date, { weekStartsOn: 1 })) return 'lastWeek';
  if (isThisMonth(date)) return 'thisMonth';
  if (isAfter(date, subMonths(now, 2))) return 'lastMonth';
  return 'older';
}

interface CommitGroup {
  group: DateGroup;
  label: string;
  commits: CommitWithRepo[];
}

function groupCommitsByDate(commits: CommitWithRepo[]): CommitGroup[] {
  const groups: Map<DateGroup, CommitWithRepo[]> = new Map();

  commits.forEach((commit) => {
    const group = getDateGroup(commit.authored_at);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)?.push(commit);
  });

  // Return groups in order, only including non-empty ones
  return DATE_GROUP_ORDER.filter((group) => groups.has(group)).map((group) => ({
    group,
    label: DATE_GROUP_LABELS[group],
    commits: groups.get(group) ?? [],
  }));
}

export function RepositoryCommits({ repositoryId }: RepositoryCommitsProps) {
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());

  const { data: commits, isLoading } = useQuery({
    queryKey: ['repository-commits', repositoryId],
    queryFn: () => getRepositoryCommits(repositoryId),
  });

  const groupedCommits = useMemo(() => {
    if (!commits) return [];
    return groupCommitsByDate(commits);
  }, [commits]);

  const toggleExpand = (commitId: string) => {
    setExpandedCommits((prev) => {
      const next = new Set(prev);
      if (next.has(commitId)) {
        next.delete(commitId);
      } else {
        next.add(commitId);
      }
      return next;
    });
  };

  // Check if commit has a body (message beyond headline)
  const hasBody = (commit: CommitWithRepo) => {
    return commit.message && commit.message.trim() !== commit.message_headline.trim();
  };

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!commits || commits.length === 0) {
    return (
      <SidekickPanel>
        <div className={styles['emptyState']}>
          <GitCommit size={32} className={styles['emptyIcon']} />
          <p className={styles['emptyTitle']}>No commits synced</p>
          <p className={styles['emptyDescription']}>
            Click &quot;Sync Now&quot; to fetch commit history from the repository.
          </p>
        </div>
      </SidekickPanel>
    );
  }

  return (
    <SidekickPanel>
      <div className={styles['commitsList']}>
        {groupedCommits.map((group) => (
          <div key={group.group} className={styles['commitGroup']}>
            <div className={styles['commitGroupHeader']}>
              <span className={styles['commitGroupLabel']}>{group.label}</span>
              <span className={styles['commitGroupCount']}>{group.commits.length}</span>
            </div>

            <div className={styles['commitGroupItems']}>
              {group.commits.map((commit) => {
                const isExpanded = expandedCommits.has(commit.commit_id);
                const canExpand = hasBody(commit);

                return (
                  <div key={commit.commit_id} className={styles['commitCard']}>
                    {/* Static Header - Always Visible */}
                    <div className={styles['commitCardHeader']}>
                      <div className={styles['commitCardIcon']}>
                        <GitCommit size={14} />
                      </div>
                      <div className={styles['commitCardHeaderContent']}>
                        <div className={styles['commitCardTitle']}>{commit.message_headline}</div>
                        <div className={styles['commitCardMeta']}>
                          <div className={styles['commitCardAuthor']}>
                            {commit.contributor?.avatar_url ? (
                              <img
                                src={commit.contributor.avatar_url}
                                alt={commit.author_name}
                                className={styles['commitCardAuthorAvatar']}
                              />
                            ) : (
                              <User size={12} />
                            )}
                            <span>{commit.author_name}</span>
                          </div>
                          <span className={styles['commitCardSha']}>{commit.short_sha}</span>
                          <span className={styles['commitCardTime']}>
                            {formatDistanceToNow(new Date(commit.authored_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => window.open(commit.html_url, '_blank')}
                        title="View on GitHub"
                      >
                        <ExternalLink size={14} />
                      </Button>
                    </div>

                    {/* Stats - Always visible */}
                    {(commit.stats.additions > 0 ||
                      commit.stats.deletions > 0 ||
                      commit.stats.files_changed > 0 ||
                      commit.is_merge_commit) && (
                      <div className={styles['commitCardStats']}>
                        {commit.stats.files_changed > 0 && (
                          <span className={styles['commitCardFilesChanged']}>
                            {commit.stats.files_changed} file
                            {commit.stats.files_changed !== 1 ? 's' : ''}
                          </span>
                        )}
                        {commit.stats.additions > 0 && (
                          <span className={styles['commitCardAdditions']}>
                            +{commit.stats.additions.toLocaleString()}
                          </span>
                        )}
                        {commit.stats.deletions > 0 && (
                          <span className={styles['commitCardDeletions']}>
                            -{commit.stats.deletions.toLocaleString()}
                          </span>
                        )}
                        {commit.is_merge_commit && (
                          <span className={styles['commitCardBadge']}>merge</span>
                        )}
                      </div>
                    )}

                    {/* Collapsible Details Section - for commit body */}
                    {canExpand && (
                      <div className={styles['commitCardSection']}>
                        <button
                          className={styles['commitCardSectionHeader']}
                          onClick={() => toggleExpand(commit.commit_id)}
                          type="button"
                        >
                          <span className={styles['commitCardSectionTitle']}>Message</span>
                          <ChevronDown
                            size={14}
                            className={clsx(
                              styles['commitCardSectionChevron'],
                              isExpanded && styles['commitCardSectionChevronOpen']
                            )}
                          />
                        </button>
                        <div
                          className={clsx(
                            styles['commitCardSectionContent'],
                            isExpanded && styles['commitCardSectionContentOpen']
                          )}
                        >
                          <div className={styles['commitCardSectionInner']}>
                            <pre className={styles['commitCardBody']}>
                              {commit.message.slice(commit.message_headline.length).trim()}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SidekickPanel>
  );
}
