import { useQuery } from '@tanstack/react-query';
import {
  Server,
  Globe,
  Clock,
  Tag,
  Cpu,
  HardDrive,
  Shield,
  Activity,
  Gauge,
  MemoryStick,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { getAgentMetrics } from '@/lib/api';
import type { Machine } from '@machina/shared';
import { PROVIDER_FULL_LABELS } from '@/shared/constants';
import {
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickGrid,
  SidekickGridItem,
  SidekickTags,
} from '../../components';
import styles from './MachineDetail.module.css';

interface MachineOverviewTabProps {
  machine: Machine;
}

const unknownStatus = { label: 'Unknown', className: '' };

const terraformStatusConfig: Record<string, { label: string; className: string }> = {
  in_sync: { label: 'In Sync', className: styles.statusSuccess ?? '' },
  drifted: { label: 'Drifted', className: styles.statusWarning ?? '' },
  pending: { label: 'Pending', className: styles.statusMuted ?? '' },
  unknown: { label: 'Unknown', className: styles.statusMuted ?? '' },
};

const agentStatusConfig: Record<string, { label: string; className: string }> = {
  connected: { label: 'Connected', className: styles.statusSuccess ?? '' },
  disconnected: { label: 'Disconnected', className: styles.statusWarning ?? '' },
  not_installed: { label: 'Not Installed', className: styles.statusMuted ?? '' },
  unknown: { label: 'Unknown', className: styles.statusMuted ?? '' },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function MachineOverviewTab({ machine }: MachineOverviewTabProps) {
  const { data: agentMetrics } = useQuery({
    queryKey: ['agent-metrics', machine.machine_id],
    queryFn: () => getAgentMetrics(machine.machine_id),
    enabled: machine.agent_status === 'connected',
    refetchInterval: 30000,
  });

  const terraformStatus = terraformStatusConfig[machine.terraform_state_status] ?? unknownStatus;
  const agentStatus = agentStatusConfig[machine.agent_status] ?? unknownStatus;

  return (
    <SidekickPanel>
      <SidekickSection title="Provider">
        <div className={styles.providerRow}>
          <span className={styles.providerName}>
            {PROVIDER_FULL_LABELS[machine.provider] || machine.provider}
          </span>
          {machine.provider_resource_id && (
            <code className={styles.providerResourceId}>{machine.provider_resource_id}</code>
          )}
        </div>
      </SidekickSection>

      <SidekickGrid>
        <SidekickGridItem label="Region" value={machine.region} icon={<Globe size={12} />} />
        <SidekickGridItem label="Size" value={machine.size} icon={<Server size={12} />} />
        <SidekickGridItem
          label="Image"
          value={machine.os_name || machine.image}
          icon={<HardDrive size={12} />}
        />
        <SidekickGridItem
          label="Age"
          value={formatDistanceToNow(new Date(machine.created_at))}
          icon={<Clock size={12} />}
        />
      </SidekickGrid>

      <SidekickSection title="Network">
        <SidekickRow label="Public IP" value={machine.public_ip ?? null} accent copyable />
        <SidekickRow label="Private IP" value={machine.private_ip ?? null} copyable />
      </SidekickSection>

      {agentMetrics && (
        <SidekickSection title="Metrics" icon={<Gauge size={12} />}>
          <div className={styles.metricsContainer}>
            <div className={styles.row}>
              <span className={styles.label}>
                <Cpu size={12} /> Load
              </span>
              <span className={styles.value}>
                {agentMetrics.load_average.map((l: number) => l.toFixed(2)).join(' / ')}
              </span>
            </div>
            <div className={styles.metricRow}>
              <div className={styles.row}>
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
                  style={{
                    width: `${(agentMetrics.memory_used_mb / agentMetrics.memory_total_mb) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className={styles.metricRow}>
              <div className={styles.row}>
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
                  style={{
                    width: `${(agentMetrics.disk_used_gb / agentMetrics.disk_total_gb) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className={clsx(styles.row, styles.uptimeRow)}>
              <span className={styles.label}>Uptime</span>
              <span className={styles.value}>{formatUptime(agentMetrics.uptime_seconds)}</span>
            </div>
          </div>
        </SidekickSection>
      )}

      <SidekickSection title="Status">
        <SidekickRow label="Terraform" value={terraformStatus.label} icon={<Shield size={12} />} />
        <SidekickRow label="Agent" value={agentStatus.label} icon={<Activity size={12} />} />
      </SidekickSection>

      {Object.keys(machine.tags).length > 0 && (
        <SidekickSection title="Tags" icon={<Tag size={12} />}>
          <SidekickTags tags={machine.tags} />
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
