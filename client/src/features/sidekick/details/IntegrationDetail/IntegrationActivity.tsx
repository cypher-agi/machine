import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Unlink,
  Link,
  Settings,
} from 'lucide-react';
import { getAuditEvents } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { SidekickPanel, SidekickLoading } from '../../components';
import styles from './IntegrationDetail.module.css';

interface IntegrationActivityProps {
  integrationId: string;
}

const ACTION_ICONS: Record<string, typeof Activity> = {
  'integration.connected': Link,
  'integration.disconnected': Unlink,
  'integration.reauthorized': RefreshCw,
  'integration.synced': CheckCircle,
  'integration.sync_failed': AlertCircle,
  'integration.configured': Settings,
};

const ACTION_LABELS: Record<string, string> = {
  'integration.connected': 'Connected',
  'integration.disconnected': 'Disconnected',
  'integration.reauthorized': 'Organizations Updated',
  'integration.synced': 'Sync Complete',
  'integration.sync_failed': 'Sync Failed',
  'integration.configured': 'Configured',
};

type ActivityStatus = 'success' | 'error' | 'warning' | 'info';

function getActivityStatus(action: string, outcome: string): ActivityStatus {
  if (outcome === 'failure') return 'error';
  if (action === 'integration.sync_failed') return 'error';
  if (action === 'integration.disconnected') return 'warning';
  if (action === 'integration.synced' || action === 'integration.connected') return 'success';
  return 'info';
}

function getSyncDetails(details?: Record<string, unknown>): string | null {
  if (!details) return null;
  const repos = details.repos_synced as number | undefined;
  const members = details.members_synced as number | undefined;

  if (repos !== undefined || members !== undefined) {
    const parts: string[] = [];
    if (repos !== undefined) parts.push(`${repos} repos`);
    if (members !== undefined) parts.push(`${members} members`);
    return parts.join(', ');
  }
  return null;
}

export function IntegrationActivity({ integrationId }: IntegrationActivityProps) {
  const { currentTeamId } = useAuthStore();

  const { data: events, isLoading } = useQuery({
    queryKey: ['audit-events', currentTeamId, 'integration', integrationId],
    queryFn: () =>
      getAuditEvents({
        target_type: 'integration',
        target_id: integrationId,
        per_page: 50,
      }),
  });

  if (isLoading) {
    return <SidekickLoading message="Loading activity..." />;
  }

  if (!events || events.length === 0) {
    return (
      <SidekickPanel>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No activity recorded</p>
          <p className={styles.emptyStateHint}>Integration activity will appear here</p>
        </div>
      </SidekickPanel>
    );
  }

  return (
    <SidekickPanel>
      <div className={styles.activityList}>
        {events.map((event) => {
          const Icon = ACTION_ICONS[event.action] || Activity;
          const label = ACTION_LABELS[event.action] || event.action;
          const status = getActivityStatus(event.action, event.outcome);
          const syncDetails = getSyncDetails(event.details);

          return (
            <div key={event.event_id} className={styles.activityItem}>
              <div
                className={`${styles.activityIcon} ${styles[`activityIcon${status.charAt(0).toUpperCase() + status.slice(1)}`]}`}
              >
                <Icon size={14} />
              </div>
              <div className={styles.activityContent}>
                <div className={styles.activityHeader}>
                  <span className={styles.activityLabel}>{label}</span>
                  {syncDetails && <span className={styles.activityDetails}>{syncDetails}</span>}
                </div>
                <div className={styles.activityMeta}>
                  {event.actor_name && <span>{event.actor_name}</span>}
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SidekickPanel>
  );
}
