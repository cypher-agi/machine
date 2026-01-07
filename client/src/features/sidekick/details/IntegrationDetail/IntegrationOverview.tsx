import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Building2 } from 'lucide-react';
import type { TeamIntegration, IntegrationDefinition } from '@machina/shared';
import { Button } from '@/shared/ui';
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
  return (
    <SidekickPanel>
      {/* Stats */}
      {stats && Object.keys(stats).length > 0 && (
        <div className={styles.statsGrid}>
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className={styles.statCard}>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{key}</div>
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
            {integration.last_sync_error && (
              <SidekickRow label="Last Error" value={integration.last_sync_error} />
            )}
          </>
        ) : (
          <SidekickRow label="Last Sync" value="Never synced" />
        )}
      </SidekickSection>

      {definition.features.length > 0 && (
        <SidekickSection title="Features">
          {definition.features.map((feature) => (
            <SidekickRow key={feature} label={feature} value="Enabled" />
          ))}
        </SidekickSection>
      )}

      <SidekickSection title="Required Scopes">
        {definition.requiredScopes.map((scope) => (
          <SidekickRow key={scope} label={scope} mono />
        ))}
      </SidekickSection>

      {/* Organizations section - styled like Team Members */}
      {onManageAccess && (
        <SidekickSection
          title={
            <div className={styles.orgSectionHeader}>
              <span>Organizations</span>
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
          }
        >
          {organizations.length > 0 ? (
            <div className={styles.orgMembersList}>
              {organizations.map((org) => {
                const repoCount = organizationRepoCount[org] || 0;
                return (
                  <a
                    key={org}
                    href={`https://github.com/${org}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.orgMemberItem}
                  >
                    <div className={styles.orgMemberAvatar}>
                      <Building2 size={14} />
                    </div>
                    <div className={styles.orgMemberInfo}>
                      <div className={styles.orgMemberName}>{org}</div>
                      <div className={styles.orgMemberMeta}>github.com/{org}</div>
                    </div>
                    {repoCount > 0 && (
                      <span className={styles.orgMemberBadge}>
                        {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          ) : (
            <p className={styles.orgEmptyMessage}>
              No organizations synced yet. Click Sync to import data.
            </p>
          )}
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
