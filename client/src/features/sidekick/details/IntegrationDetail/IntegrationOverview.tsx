import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Building2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import type { TeamIntegration, IntegrationDefinition } from '@machina/shared';
import { Button } from '@/shared';
import { copyToClipboard } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import { SidekickPanel, SidekickSection, SidekickRow } from '../../components';
import styles from './IntegrationDetail.module.css';

interface IntegrationOverviewProps {
  integration: TeamIntegration;
  stats?: Record<string, number>;
  definition: IntegrationDefinition;
  organizations?: string[];
  organizationRepoCount?: Record<string, number>;
  onManageAccess?: () => void;
  isManagingAccess?: boolean;
}

export function IntegrationOverview({
  integration,
  stats,
  definition,
  organizations = [],
  organizationRepoCount = {},
  onManageAccess,
  isManagingAccess,
}: IntegrationOverviewProps) {
  const { addToast } = useAppStore();
  const [errorExpanded, setErrorExpanded] = useState(false);

  return (
    <SidekickPanel>
      {/* Stats */}
      {stats && Object.keys(stats).length > 0 && (
        <div className={styles['statsGrid']}>
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className={styles['statCard']}>
              <div className={styles['statValue']}>{value}</div>
              <div className={styles['statLabel']}>{key}</div>
            </div>
          ))}
        </div>
      )}

      <SidekickSection title="Connection">
        <SidekickRow label="Account" value={integration.external_account_name} />
        <SidekickRow label="Status" value={integration.status} />
        {integration.connected_by_external_name && (
          <SidekickRow label="Connected By" value={integration.connected_by_external_name} />
        )}
        <SidekickRow
          label="Connected"
          value={formatDistanceToNow(new Date(integration.created_at), { addSuffix: true })}
        />
      </SidekickSection>

      <SidekickSection title="Sync">
        {integration.last_sync_at ? (
          <>
            <SidekickRow
              label="Last Sync"
              value={formatDistanceToNow(new Date(integration.last_sync_at), { addSuffix: true })}
            />
            <SidekickRow label="Sync Status" value={integration.last_sync_status || 'unknown'} />
          </>
        ) : (
          <SidekickRow label="Last Sync" value="Never synced" />
        )}
      </SidekickSection>

      {integration.last_sync_error && (
        <SidekickSection title="Last Error">
          <div className={styles['errorContainer']}>
            <div
              className={`${styles['errorText']} ${errorExpanded ? styles['errorTextExpanded'] : ''}`}
              onClick={() => setErrorExpanded(!errorExpanded)}
            >
              {integration.last_sync_error}
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
                  await copyToClipboard(integration.last_sync_error ?? '');
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

      {definition.features.length > 0 && (
        <SidekickSection title="Features">
          {definition.features.map((feature: string) => (
            <SidekickRow key={feature} label={feature} value="Enabled" />
          ))}
        </SidekickSection>
      )}

      <SidekickSection title="Required Scopes">
        {definition.requiredScopes.map((scope: string) => (
          <SidekickRow key={scope} label={scope} mono />
        ))}
      </SidekickSection>

      {/* Organizations section */}
      {onManageAccess && (
        <SidekickSection title="Organizations">
          {organizations.length > 0 ? (
            <div className={styles['orgMembersList']}>
              {organizations.map((org) => {
                const repoCount = organizationRepoCount[org] || 0;
                return (
                  <a
                    key={org}
                    href={`https://github.com/${org}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles['orgMemberItem']}
                  >
                    <div className={styles['orgMemberAvatar']}>
                      <Building2 size={14} />
                    </div>
                    <div className={styles['orgMemberInfo']}>
                      <div className={styles['orgMemberName']}>{org}</div>
                      <div className={styles['orgMemberMeta']}>github.com/{org}</div>
                    </div>
                    {repoCount > 0 && (
                      <span className={styles['orgMemberBadge']}>
                        {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          ) : (
            <p className={styles['orgEmptyMessage']}>
              No organizations synced yet. Click Sync to import data.
            </p>
          )}
          <div className={styles['manageAccessRow']}>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onManageAccess();
              }}
              disabled={isManagingAccess}
            >
              <ExternalLink size={12} />
              Manage Access
            </Button>
          </div>
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
