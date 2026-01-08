import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Copy,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
  GitFork,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { RepositoryWithStats } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { copyToClipboard } from '@/shared/lib';
import { Button } from '@/shared/ui';
import { SidekickPanel, SidekickSection, SidekickRow } from '../../components';
import styles from './RepositoryDetail.module.css';

interface RepositoryOverviewProps {
  repository: RepositoryWithStats;
}

export function RepositoryOverview({ repository }: RepositoryOverviewProps) {
  const { addToast } = useAppStore();
  const [errorExpanded, setErrorExpanded] = useState(false);

  return (
    <SidekickPanel>
      {/* Stats Grid */}
      <div className={styles['statsGrid']}>
        <div className={styles['statCard']}>
          <div className={styles['statValue']}>{repository.commits_synced_count}</div>
          <div className={styles['statLabel']}>Commits</div>
        </div>
        <div className={styles['statCard']}>
          <div className={styles['statValue']}>{repository.prs_synced_count}</div>
          <div className={styles['statLabel']}>PRs</div>
        </div>
        <div className={styles['statCard']}>
          <div className={styles['statValue']}>{repository.contributor_count}</div>
          <div className={styles['statLabel']}>Contributors</div>
        </div>
      </div>

      {/* GitHub Stats */}
      {(repository.stargazers_count > 0 || repository.forks_count > 0) && (
        <div className={styles['githubStats']}>
          {repository.stargazers_count > 0 && (
            <div className={styles['githubStat']}>
              <Star size={14} />
              <span>{repository.stargazers_count.toLocaleString()}</span>
            </div>
          )}
          {repository.forks_count > 0 && (
            <div className={styles['githubStat']}>
              <GitFork size={14} />
              <span>{repository.forks_count.toLocaleString()}</span>
            </div>
          )}
          {repository.open_issues_count > 0 && (
            <div className={styles['githubStat']}>
              <AlertCircle size={14} />
              <span>{repository.open_issues_count.toLocaleString()} issues</span>
            </div>
          )}
        </div>
      )}

      {/* Overview */}
      <SidekickSection title="Overview">
        <SidekickRow label="Source" value={repository.source_type} />
        <SidekickRow label="Default Branch" value={repository.default_branch} mono />
        {repository.primary_language && (
          <SidekickRow label="Language" value={repository.primary_language} />
        )}
        <SidekickRow label="Visibility" value={repository.is_private ? 'Private' : 'Public'} />
        {repository.is_archived && <SidekickRow label="Status" value="Archived" />}
        {repository.owner_name && <SidekickRow label="Owner" value={repository.owner_name} />}
      </SidekickSection>

      {/* Description */}
      {repository.description && (
        <SidekickSection title="Description">
          <p className={styles['description']}>{repository.description}</p>
        </SidekickSection>
      )}

      {/* URL */}
      <SidekickSection title="URL">
        <div className={styles['urlSection']}>
          <code className={styles['urlText']}>{repository.url}</code>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => window.open(repository.url, '_blank')}
            title="Open in GitHub"
          >
            <ExternalLink size={14} />
          </Button>
        </div>
      </SidekickSection>

      {/* Sync Status */}
      <SidekickSection title="Sync Status">
        <SidekickRow
          label="Status"
          value={
            repository.sync_status === 'synced' ? (
              'Synced'
            ) : repository.sync_status === 'syncing' ? (
              <span className={styles['syncingStatus']}>
                <RefreshCw size={12} className={styles['syncingIcon']} />
                Syncing...
              </span>
            ) : repository.sync_status === 'error' ? (
              'Error'
            ) : (
              'Idle'
            )
          }
        />
        {repository.last_sync_at && (
          <SidekickRow
            label="Last Synced"
            value={formatDistanceToNow(new Date(repository.last_sync_at), { addSuffix: true })}
          />
        )}
        {repository.pushed_at_source && (
          <SidekickRow
            label="Last Push"
            value={formatDistanceToNow(new Date(repository.pushed_at_source), { addSuffix: true })}
          />
        )}
      </SidekickSection>

      {/* Error Display */}
      {repository.last_sync_error && (
        <SidekickSection title="Last Error">
          <div className={styles['errorContainer']}>
            <div
              className={`${styles['errorText']} ${errorExpanded ? styles['errorTextExpanded'] : ''}`}
              onClick={() => setErrorExpanded(!errorExpanded)}
            >
              {repository.last_sync_error}
            </div>
            <div className={styles['errorActions']}>
              <button
                className={styles['errorButton']}
                onClick={() => setErrorExpanded(!errorExpanded)}
                title={errorExpanded ? 'Collapse' : 'Expand'}
              >
                {errorExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button
                className={styles['errorButton']}
                onClick={async () => {
                  await copyToClipboard(repository.last_sync_error ?? '');
                  addToast({ type: 'info', title: 'Copied', message: 'Error copied to clipboard' });
                }}
                title="Copy error"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </SidekickSection>
      )}

      {/* Clone URL */}
      {repository.clone_url && (
        <SidekickSection title="Clone">
          <SidekickRow label="Clone URL" value={repository.clone_url} mono copyable />
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
