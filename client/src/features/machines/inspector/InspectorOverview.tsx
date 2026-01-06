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
  aws: 'Amazon Web Services',
  gcp: 'Google Cloud Platform',
  hetzner: 'Hetzner',
  baremetal: 'Bare Metal',
};

const terraformStatusConfig: Record<string, { label: string; class: string }> = {
  in_sync: { label: 'In Sync', class: 'text-status-running' },
  drifted: { label: 'Drifted', class: 'text-status-warning' },
  pending: { label: 'Pending', class: 'text-status-pending' },
  unknown: { label: 'Unknown', class: 'text-text-tertiary' },
};

const agentStatusConfig: Record<string, { label: string; class: string }> = {
  connected: { label: 'Connected', class: 'text-status-running' },
  disconnected: { label: 'Disconnected', class: 'text-status-warning' },
  not_installed: { label: 'Not Installed', class: 'text-text-tertiary' },
  unknown: { label: 'Unknown', class: 'text-text-tertiary' },
};

export function InspectorOverview({ machine }: InspectorOverviewProps) {
  const terraformStatus = terraformStatusConfig[machine.terraform_state_status] || terraformStatusConfig.unknown;
  const agentStatus = agentStatusConfig[machine.agent_status] || agentStatusConfig.unknown;

  // Fetch agent metrics if agent is connected
  const { data: agentMetrics } = useQuery({
    queryKey: ['agent-metrics', machine.machine_id],
    queryFn: () => getAgentMetrics(machine.machine_id),
    enabled: machine.agent_status === 'connected',
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="p-4 space-y-6">
      {/* Provider Provenance */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Provider
        </h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-machine-elevated border border-machine-border flex items-center justify-center text-xl">
            {machine.provider === 'digitalocean' && '🌊'}
            {machine.provider === 'aws' && '☁️'}
            {machine.provider === 'gcp' && '🔷'}
            {machine.provider === 'hetzner' && '🏢'}
            {machine.provider === 'baremetal' && '🖥️'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary">
              {providerLabels[machine.provider] || machine.provider}
            </p>
            <p className="text-sm text-text-secondary">
              Provisioned via {machine.provisioning_method === 'provider_api' ? 'Terraform' : machine.provisioning_method}
            </p>
          </div>
        </div>
        {machine.provider_resource_id && (
          <div className="mt-3 pt-3 border-t border-machine-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary uppercase">Resource ID</span>
              <code className="font-mono text-sm text-text-primary">
                {machine.provider_resource_id}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary uppercase">Region</span>
          </div>
          <p className="font-mono text-text-primary">{machine.region}</p>
          {machine.zone && (
            <p className="text-xs text-text-secondary">{machine.zone}</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary uppercase">Size</span>
          </div>
          <p className="font-mono text-text-primary">{machine.size}</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive className="w-4 h-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary uppercase">Image</span>
          </div>
          <p className="font-mono text-text-primary text-sm truncate" title={machine.image}>
            {machine.os_name || machine.image}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary uppercase">Age</span>
          </div>
          <p className="text-text-primary">
            {formatDistanceToNow(new Date(machine.created_at))}
          </p>
        </div>
      </div>

      {/* Network Info */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Network
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Public IP</span>
            <code className="font-mono text-sm text-neon-cyan">
              {machine.public_ip || '—'}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Private IP</span>
            <code className="font-mono text-sm text-text-primary">
              {machine.private_ip || '—'}
            </code>
          </div>
          {machine.vpc_id && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">VPC</span>
              <code className="font-mono text-sm text-text-primary truncate max-w-[180px]">
                {machine.vpc_id}
              </code>
            </div>
          )}
        </div>
      </div>

      {/* Agent Metrics - Only show when agent is connected */}
      {agentMetrics && (
        <div className="card">
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            System Metrics
          </h3>
          <div className="space-y-3">
            {/* CPU Load */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Load Average
                </span>
                <span className="text-sm font-mono text-text-primary">
                  {agentMetrics.load_average.map(l => l.toFixed(2)).join(' / ')}
                </span>
              </div>
            </div>

            {/* Memory */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary flex items-center gap-2">
                  <MemoryStick className="w-4 h-4" />
                  Memory
                </span>
                <span className="text-sm font-mono text-text-primary">
                  {Math.round(agentMetrics.memory_used_mb / 1024 * 10) / 10} / {Math.round(agentMetrics.memory_total_mb / 1024 * 10) / 10} GB
                </span>
              </div>
              <div className="h-1.5 bg-machine-elevated rounded-full overflow-hidden">
                <div 
                  className="h-full bg-neon-cyan rounded-full transition-all"
                  style={{ width: `${(agentMetrics.memory_used_mb / agentMetrics.memory_total_mb) * 100}%` }}
                />
              </div>
            </div>

            {/* Disk */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Disk
                </span>
                <span className="text-sm font-mono text-text-primary">
                  {agentMetrics.disk_used_gb} / {agentMetrics.disk_total_gb} GB
                </span>
              </div>
              <div className="h-1.5 bg-machine-elevated rounded-full overflow-hidden">
                <div 
                  className="h-full bg-neon-green rounded-full transition-all"
                  style={{ width: `${(agentMetrics.disk_used_gb / agentMetrics.disk_total_gb) * 100}%` }}
                />
              </div>
            </div>

            {/* Uptime */}
            <div className="flex items-center justify-between pt-2 border-t border-machine-border">
              <span className="text-sm text-text-secondary flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Uptime
              </span>
              <span className="text-sm font-mono text-text-primary">
                {formatUptime(agentMetrics.uptime_seconds)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status Indicators */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Status
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Terraform State
            </span>
            <span className={clsx('text-sm font-medium', terraformStatus.class)}>
              {terraformStatus.label}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Agent Status
            </span>
            <span className={clsx('text-sm font-medium', agentStatus.class)}>
              {agentStatus.label}
            </span>
          </div>
          {machine.last_health_check && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Last Health Check</span>
              <span className="text-sm text-text-primary">
                {formatDistanceToNow(new Date(machine.last_health_check), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {Object.keys(machine.tags).length > 0 && (
        <div className="card">
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(machine.tags).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-machine-elevated border border-machine-border rounded"
              >
                <span className="text-text-secondary">{key}:</span>
                <span className="text-text-primary">{value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



