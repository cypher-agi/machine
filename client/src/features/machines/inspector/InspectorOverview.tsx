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
  MemoryStick
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import type { Machine } from '@machine/shared';
import clsx from 'clsx';
import { getAgentMetrics } from '@/lib/api';

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

const terraformStatusConfig: Record<string, { label: string; class: string }> = {
  in_sync: { label: 'In Sync', class: 'text-status-success' },
  drifted: { label: 'Drifted', class: 'text-status-warning' },
  pending: { label: 'Pending', class: 'text-status-pending' },
  unknown: { label: 'Unknown', class: 'text-text-muted' },
};

const agentStatusConfig: Record<string, { label: string; class: string }> = {
  connected: { label: 'Connected', class: 'text-status-success' },
  disconnected: { label: 'Disconnected', class: 'text-status-warning' },
  not_installed: { label: 'Not Installed', class: 'text-text-muted' },
  unknown: { label: 'Unknown', class: 'text-text-muted' },
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
    <div className="p-3 space-y-3">
      {/* Provider */}
      <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Provider</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary font-medium">
            {providerLabels[machine.provider] || machine.provider}
          </span>
          {machine.provider_resource_id && (
            <code className="text-[10px] font-mono text-text-muted">
              {machine.provider_resource_id}
            </code>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-cursor-surface border border-cursor-border rounded-md">
          <div className="flex items-center gap-1 mb-1">
            <Globe className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">Region</span>
          </div>
          <span className="font-mono text-xs text-text-primary">{machine.region}</span>
        </div>

        <div className="p-2 bg-cursor-surface border border-cursor-border rounded-md">
          <div className="flex items-center gap-1 mb-1">
            <Server className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">Size</span>
          </div>
          <span className="font-mono text-xs text-text-primary">{machine.size}</span>
        </div>

        <div className="p-2 bg-cursor-surface border border-cursor-border rounded-md">
          <div className="flex items-center gap-1 mb-1">
            <HardDrive className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">Image</span>
          </div>
          <span className="font-mono text-xs text-text-primary truncate block" title={machine.image}>
            {machine.os_name || machine.image}
          </span>
        </div>

        <div className="p-2 bg-cursor-surface border border-cursor-border rounded-md">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">Age</span>
          </div>
          <span className="text-xs text-text-primary">
            {formatDistanceToNow(new Date(machine.created_at))}
          </span>
        </div>
      </div>

      {/* Network */}
      <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Network</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Public IP</span>
            <code className="font-mono text-accent-blue">{machine.public_ip || '—'}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Private IP</span>
            <code className="font-mono text-text-primary">{machine.private_ip || '—'}</code>
          </div>
        </div>
      </div>

      {/* Agent Metrics */}
      {agentMetrics && (
        <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
          <div className="flex items-center gap-1 mb-2">
            <Gauge className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Metrics</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Load
                </span>
                <span className="font-mono text-text-primary">
                  {agentMetrics.load_average.map(l => l.toFixed(2)).join(' / ')}
                </span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted flex items-center gap-1">
                  <MemoryStick className="w-3 h-3" /> Memory
                </span>
                <span className="font-mono text-text-primary">
                  {Math.round(agentMetrics.memory_used_mb / 1024 * 10) / 10}/{Math.round(agentMetrics.memory_total_mb / 1024 * 10) / 10}GB
                </span>
              </div>
              <div className="h-1 bg-cursor-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent-blue rounded-full"
                  style={{ width: `${(agentMetrics.memory_used_mb / agentMetrics.memory_total_mb) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-muted flex items-center gap-1">
                  <HardDrive className="w-3 h-3" /> Disk
                </span>
                <span className="font-mono text-text-primary">
                  {agentMetrics.disk_used_gb}/{agentMetrics.disk_total_gb}GB
                </span>
              </div>
              <div className="h-1 bg-cursor-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-status-success rounded-full"
                  style={{ width: `${(agentMetrics.disk_used_gb / agentMetrics.disk_total_gb) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-cursor-border">
              <span className="text-text-muted">Uptime</span>
              <span className="font-mono text-text-primary">{formatUptime(agentMetrics.uptime_seconds)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Status</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted flex items-center gap-1">
              <Shield className="w-3 h-3" /> Terraform
            </span>
            <span className={clsx('font-medium', terraformStatus.class)}>{terraformStatus.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted flex items-center gap-1">
              <Activity className="w-3 h-3" /> Agent
            </span>
            <span className={clsx('font-medium', agentStatus.class)}>{agentStatus.label}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      {Object.keys(machine.tags).length > 0 && (
        <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
          <div className="flex items-center gap-1 mb-2">
            <Tag className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(machine.tags).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-cursor-bg border border-cursor-border rounded"
              >
                <span className="text-text-muted">{key}:</span>
                <span className="text-text-primary">{value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
