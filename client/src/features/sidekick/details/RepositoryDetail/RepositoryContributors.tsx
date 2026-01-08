import { useQuery } from '@tanstack/react-query';
import { Users, ExternalLink, GitCommit, GitPullRequest } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Contributor } from '@machina/shared';
import { getContributors } from '@/lib/api';
import { Button } from '@/shared/ui';
import { SidekickPanel, SidekickLoading } from '../../components';
import styles from './RepositoryDetail.module.css';

interface RepositoryContributorsProps {
  repositoryId: string;
}

export function RepositoryContributors({ repositoryId }: RepositoryContributorsProps) {
  const { data: contributors, isLoading } = useQuery({
    queryKey: ['repository-contributors', repositoryId],
    queryFn: () => getContributors({ repo_id: repositoryId }),
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!contributors || contributors.length === 0) {
    return (
      <SidekickPanel>
        <div className={styles['emptyState']}>
          <Users size={32} className={styles['emptyIcon']} />
          <p className={styles['emptyTitle']}>No contributors found</p>
          <p className={styles['emptyDescription']}>
            Sync the repository to discover contributors from commit history.
          </p>
        </div>
      </SidekickPanel>
    );
  }

  // Sort by total commits (descending)
  const sortedContributors = [...contributors].sort((a, b) => b.total_commits - a.total_commits);

  return (
    <SidekickPanel>
      <div className={styles['contributorsList']}>
        {sortedContributors.map((contributor) => (
          <ContributorCard key={contributor.contributor_id} contributor={contributor} />
        ))}
      </div>
    </SidekickPanel>
  );
}

interface ContributorCardProps {
  contributor: Contributor;
}

function ContributorCard({ contributor }: ContributorCardProps) {
  // Get GitHub account if available
  const githubAccount = contributor.external_accounts?.find(
    (account) => account.source_type === 'github'
  );

  const initials = contributor.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={styles['contributorCard']}>
      <div className={styles['contributorAvatar']}>
        {githubAccount?.avatar_url ? (
          <img
            src={githubAccount.avatar_url}
            alt={contributor.name}
            className={styles['contributorAvatarImg']}
          />
        ) : (
          <span className={styles['contributorInitials']}>{initials}</span>
        )}
      </div>

      <div className={styles['contributorContent']}>
        <div className={styles['contributorHeader']}>
          <span className={styles['contributorName']}>{contributor.name}</span>
          {contributor.team_member_id && (
            <span className={styles['contributorTeamBadge']}>Team Member</span>
          )}
        </div>

        {githubAccount && (
          <div className={styles['contributorUsername']}>@{githubAccount.username}</div>
        )}

        <div className={styles['contributorEmail']}>{contributor.email}</div>

        <div className={styles['contributorStats']}>
          <div className={styles['contributorStat']}>
            <GitCommit size={12} />
            <span>{contributor.total_commits} commits</span>
          </div>
          <div className={styles['contributorStat']}>
            <GitPullRequest size={12} />
            <span>{contributor.total_prs} PRs</span>
          </div>
        </div>

        {contributor.last_commit_at && (
          <div className={styles['contributorLastActive']}>
            Last commit{' '}
            {formatDistanceToNow(new Date(contributor.last_commit_at), { addSuffix: true })}
          </div>
        )}
      </div>

      {githubAccount?.profile_url && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={(e) => {
            e.stopPropagation();
            window.open(githubAccount.profile_url, '_blank');
          }}
          title="View on GitHub"
          className={styles['contributorAction']}
        >
          <ExternalLink size={14} />
        </Button>
      )}
    </div>
  );
}
