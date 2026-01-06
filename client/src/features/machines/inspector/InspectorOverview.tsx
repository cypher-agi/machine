import { Server, Globe, Clock, Tag, Cpu, HardDrive, Shield, Activity, Gauge, MemoryStick } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import type { Machine } from '@machina/shared';
import clsx from 'clsx';
import { getAgentMetrics } from '@/lib/api';
import styles from './Inspector.module.css';

interface InspectorOverviewProps {
  machine: Machine;
}

const providerLabels: Record<string, string> = {
  digitalocean: 'DigitalOcean',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'Hetzner',
  baremetal: 'Bare Metal',
};

const terraformStatusConfig: Record<string, { label: string; className: string }> = {
  in_sync: { label: 'In Sync', className: styles.statusSuccess },
  drifted: { label: 'Drifted', className: styles.statusWarning },
  pending: { label: 'Pending', className: styles.statusMuted },
  unknown: { label: 'Unknown', className: styles.statusMuted },
};

const agentStatusConfig: Record<string, { label: string; className: string }> = {
  connected: { label: 'Connected', className: styles.statusSuccess },
  disconnected: { label: 'Disconnected', className: styles.statusWarning },
  not_installed: { label: 'Not Installed', className: styles.statusMuted },
  unknown: { label: 'Unknown', className: styles.statusMuted },
};

export function InspectorOverview({ machine }: InspectorOverviewProps) {
  const terraformStatus = terraformStatusConfig[machine.terraform_state_status] || terraformStatusConfig.unknown;
  const agentStatus = agentStatusConfig[machine.agent_status] || agentStatusConfig.unknown;

  const { data: agentMetrics } = useQuery({
    queryKey: ['agent-metrics', machine.machine_id],
    queryFn: () => getAgentMetrics(machine.machine_id),
    enabled: machine.agent_status === 'connected',
    refetchInterval: 30000,
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className={styles.panel}>
      {/* Provider */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Provider</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
            {providerLabels[machine.provider] || machine.provider}
          </span>
          {machine.provider_resource_id && (
            <code style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              {machine.provider_resource_id}
            </code>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className={styles.grid} style={{ marginBottom: 'var(--space-3)' }}>
        <div className={styles.gridItem}>
          <div className={styles.gridLabel}>
            <Globe size={12} />
            <span>Region</span>
          </div>
          <span className={styles.gridValue}>{machine.region}</span>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.gridLabel}>
            <Server size={12} />
            <span>Size</span>
          </div>
          <span className={styles.gridValue}>{machine.size}</span>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.gridLabel}>
            <HardDrive size={12} />
            <span>Image</span>
          </div>
          <span className={styles.gridValue} title={machine.image}>
            {machine.os_name || machine.image}
          </span>
        </div>

        <div className={styles.gridItem}>
          <div className={styles.gridLabel}>
            <Clock size={12} />
            <span>Age</span>
          </div>
          <span className={styles.gridValue}>{formatDistanceToNow(new Date(machine.created_at))}</span>
        </div>
      </div>

      {/* Network */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Network</div>
        <div className={styles.row}>
          <span className={styles.label}>Public IP</span>
          <code className={clsx(styles.value, styles.valueAccent)}>{machine.public_ip || '—'}</code>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Private IP</span>
          <code className={styles.value}>{machine.private_ip || '—'}</code>
        </div>
      </div>

      {/* Agent Metrics */}
      {agentMetrics && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Gauge size={12} />
            Metrics
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div>
              <div className={styles.row} style={{ marginBottom: 'var(--space-1)' }}>
                <span className={styles.label}>
                  <Cpu size={12} /> Load
                </span>
                <span className={styles.value}>
                  {agentMetrics.load_average.map((l) => l.toFixed(2)).join(' / ')}
                </span>
              </div>
            </div>
            <div>
              <div className={styles.row} style={{ marginBottom: 'var(--space-1)' }}>
                <span className={styles.label}>
                  <MemoryStick size={12} /> Memory
                </span>
                <span className={styles.value}>
                  {Math.round((agentMetrics.memory_used_mb / 1024) * 10) / 10}/
                  {Math.round((agentMetrics.memory_total_mb / 1024) * 10) / 10}GB
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={clsx(styles.progressFill, styles.progressFillBlue)}
                  style={{ width: `${(agentMetrics.memory_used_mb / agentMetrics.memory_total_mb) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className={styles.row} style={{ marginBottom: 'var(--space-1)' }}>
                <span className={styles.label}>
                  <HardDrive size={12} /> Disk
                </span>
                <span className={styles.value}>
                  {agentMetrics.disk_used_gb}/{agentMetrics.disk_total_gb}GB
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={clsx(styles.progressFill, styles.progressFillGreen)}
                  style={{ width: `${(agentMetrics.disk_used_gb / agentMetrics.disk_total_gb) * 100}%` }}
                />
              </div>
            </div>
            <div className={styles.row} style={{ paddingTop: 'var(--space-1)', borderTop: '1px solid var(--color-border)' }}>
              <span className={styles.label}>Uptime</span>
              <span className={styles.value}>{formatUptime(agentMetrics.uptime_seconds)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Status</div>
        <div className={styles.row}>
          <span className={styles.label}>
            <Shield size={12} /> Terraform
          </span>
          <span className={clsx(styles.value, terraformStatus.className)}>{terraformStatus.label}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>
            <Activity size={12} /> Agent
          </span>
          <span className={clsx(styles.value, agentStatus.className)}>{agentStatus.label}</span>
        </div>
      </div>

      {/* Tags */}
      {Object.keys(machine.tags).length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Tag size={12} />
            Tags
          </div>
          <div className={styles.tags}>
            {Object.entries(machine.tags).map(([key, value]) => (
              <span key={key} className={styles.tag}>
                <span className={styles.tagKey}>{key}:</span>
                <span className={styles.tagValue}>{value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
