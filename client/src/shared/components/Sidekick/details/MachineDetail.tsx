import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Server, Globe, Clock, Tag, Cpu, HardDrive, Shield, Activity, Gauge, MemoryStick } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';
import { getMachine, getMachineServices, getMachineNetworking, getDeployments, getAgentMetrics } from '@/lib/api';
import type { MachineStatus, Machine } from '@machina/shared';
import { Badge, Button } from '@/shared/ui';
import { TerminalModal } from '@/components/terminal/TerminalModal';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickGrid,
  SidekickGridItem,
  SidekickTags,
  SidekickLoading,
  SidekickEmpty,
  SidekickJson,
} from '../Sidekick';
import styles from '../Sidekick.module.css';

interface MachineDetailProps {
  machineId: string;
  onClose: () => void;
}

const statusConfig: Record<MachineStatus, { label: string; variant: 'running' | 'stopped' | 'provisioning' | 'pending' | 'error' }> = {
  running: { label: 'Running', variant: 'running' },
  stopped: { label: 'Stopped', variant: 'stopped' },
  provisioning: { label: 'Provisioning', variant: 'provisioning' },
  pending: { label: 'Pending', variant: 'pending' },
  stopping: { label: 'Stopping', variant: 'pending' },
  rebooting: { label: 'Rebooting', variant: 'provisioning' },
  terminating: { label: 'Terminating', variant: 'error' },
  terminated: { label: 'Terminated', variant: 'stopped' },
  error: { label: 'Error', variant: 'error' },
};

const providerLabels: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
  baremetal: 'BM',
};

const providerFullLabels: Record<string, string> = {
  digitalocean: 'DigitalOcean',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'Hetzner',
  baremetal: 'Bare Metal',
};

type TabId = 'overview' | 'deployments' | 'networking' | 'services' | 'details';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'deployments', label: 'Deploys' },
  { id: 'networking', label: 'Network' },
  { id: 'services', label: 'Services' },
  { id: 'details', label: 'Details' },
];

export function MachineDetail({ machineId, onClose }: MachineDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showTerminal, setShowTerminal] = useState(false);

  const { data: machine, isLoading } = useQuery({
    queryKey: ['machine', machineId],
    queryFn: () => getMachine(machineId),
    refetchInterval: 5000,
  });

  const { data: services } = useQuery({
    queryKey: ['machine-services', machineId],
    queryFn: () => getMachineServices(machineId),
    enabled: !!machine,
  });

  const { data: networking } = useQuery({
    queryKey: ['machine-networking', machineId],
    queryFn: () => getMachineNetworking(machineId),
    enabled: !!machine,
  });

  const { data: deployments } = useQuery({
    queryKey: ['deployments', { machine_id: machineId }],
    queryFn: () => getDeployments({ machine_id: machineId }),
    enabled: !!machine,
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!machine) {
    return <SidekickLoading message="Machine not found" />;
  }

  const status = statusConfig[machine.actual_status] || statusConfig.error;

  return (
    <>
      <SidekickHeader
        iconText={providerLabels[machine.provider] || '??'}
        name={machine.name}
        subtitle={`${machine.provider.toUpperCase()} · ${machine.region} · ${machine.size}`}
        statusBadge={<Badge variant={status.variant}>{status.label}</Badge>}
        onClose={onClose}
        quickCode={machine.public_ip || undefined}
        quickCodeLabel="IP Address"
        quickActions={
          machine.public_ip && machine.actual_status === 'running' ? (
            <Button variant="primary" size="sm" onClick={() => setShowTerminal(true)}>
              <Terminal size={14} />
              SSH
            </Button>
          ) : undefined
        }
      />

      <SidekickTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <SidekickContent>
        {activeTab === 'overview' && <MachineOverview machine={machine} />}
        {activeTab === 'deployments' && <MachineDeployments deployments={deployments || []} />}
        {activeTab === 'networking' && <MachineNetworking networking={networking} />}
        {activeTab === 'services' && <MachineServices machineId={machineId} services={services} />}
        {activeTab === 'details' && <MachineDetails machine={machine} />}
      </SidekickContent>

      {showTerminal && (
        <TerminalModal machine={machine} onClose={() => setShowTerminal(false)} />
      )}
    </>
  );
}

// ========== Tab Content Components ==========

function MachineOverview({ machine }: { machine: Machine }) {
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

  const { data: agentMetrics } = useQuery({
    queryKey: ['agent-metrics', machine.machine_id],
    queryFn: () => getAgentMetrics(machine.machine_id),
    enabled: machine.agent_status === 'connected',
    refetchInterval: 30000,
  });

  const terraformStatus = terraformStatusConfig[machine.terraform_state_status] || terraformStatusConfig.unknown;
  const agentStatus = agentStatusConfig[machine.agent_status] || agentStatusConfig.unknown;

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <SidekickPanel>
      <SidekickSection title="Provider">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
            {providerFullLabels[machine.provider] || machine.provider}
          </span>
          {machine.provider_resource_id && (
            <code style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
              {machine.provider_resource_id}
            </code>
          )}
        </div>
      </SidekickSection>

      <SidekickGrid>
        <SidekickGridItem label="Region" value={machine.region} icon={<Globe size={12} />} />
        <SidekickGridItem label="Size" value={machine.size} icon={<Server size={12} />} />
        <SidekickGridItem label="Image" value={machine.os_name || machine.image} icon={<HardDrive size={12} />} />
        <SidekickGridItem label="Age" value={formatDistanceToNow(new Date(machine.created_at))} icon={<Clock size={12} />} />
      </SidekickGrid>

      <SidekickSection title="Network">
        <SidekickRow label="Public IP" value={machine.public_ip} accent copyable />
        <SidekickRow label="Private IP" value={machine.private_ip} copyable />
      </SidekickSection>

      {agentMetrics && (
        <SidekickSection title="Metrics" icon={<Gauge size={12} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div className={styles.row} style={{ marginBottom: 'var(--space-1)' }}>
              <span className={styles.label}><Cpu size={12} /> Load</span>
              <span className={styles.value}>{agentMetrics.load_average.map((l: number) => l.toFixed(2)).join(' / ')}</span>
            </div>
            <div>
              <div className={styles.row} style={{ marginBottom: 'var(--space-1)' }}>
                <span className={styles.label}><MemoryStick size={12} /> Memory</span>
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
                <span className={styles.label}><HardDrive size={12} /> Disk</span>
                <span className={styles.value}>{agentMetrics.disk_used_gb}/{agentMetrics.disk_total_gb}GB</span>
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
        </SidekickSection>
      )}

      <SidekickSection title="Status">
        <SidekickRow 
          label="Terraform" 
          value={terraformStatus.label} 
          icon={<Shield size={12} />}
        />
        <SidekickRow 
          label="Agent" 
          value={agentStatus.label} 
          icon={<Activity size={12} />}
        />
      </SidekickSection>

      {Object.keys(machine.tags).length > 0 && (
        <SidekickSection title="Tags" icon={<Tag size={12} />}>
          <SidekickTags tags={machine.tags} />
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}

function MachineDeployments({ deployments }: { deployments: any[] }) {
  if (!deployments.length) {
    return <SidekickEmpty message="No deployments" />;
  }

  return (
    <SidekickPanel>
      {deployments.slice(0, 10).map((deployment) => (
        <div key={deployment.deployment_id} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>
                <span className={styles.cardName}>{deployment.type}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  {deployment.state}
                </span>
              </div>
              <span className={styles.cardMeta}>
                {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </SidekickPanel>
  );
}

function MachineNetworking({ networking }: { networking: any }) {
  if (!networking) {
    return <SidekickEmpty message="No networking information" />;
  }

  return (
    <SidekickPanel>
      {networking.open_ports?.length > 0 && (
        <SidekickSection title="Open Ports">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {networking.open_ports.map((port: number) => (
              <span key={port} className={styles.tag}>
                <span className={styles.tagSimple}>{port}</span>
              </span>
            ))}
          </div>
        </SidekickSection>
      )}

      {networking.firewall_rules?.length > 0 && (
        <SidekickSection title="Firewall Rules">
          {networking.firewall_rules.map((rule: any, idx: number) => (
            <div key={idx} className={styles.row}>
              <span className={styles.label}>{rule.protocol.toUpperCase()} {rule.port}</span>
              <span className={styles.value}>{rule.source || '0.0.0.0/0'}</span>
            </div>
          ))}
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}

function MachineServices({ machineId, services }: { machineId: string; services: any }) {
  if (!services?.length) {
    return <SidekickEmpty message="No services configured" />;
  }

  return (
    <SidekickPanel>
      {services.map((service: any) => (
        <div key={service.service_name} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>
                <span className={styles.cardName}>{service.display_name}</span>
                {service.version && (
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    {service.version}
                  </span>
                )}
              </div>
              <span className={styles.cardMeta}>{service.systemd_unit}</span>
            </div>
          </div>
        </div>
      ))}
    </SidekickPanel>
  );
}

function MachineDetails({ machine }: { machine: Machine }) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="Machine ID" value={machine.machine_id} copyable />
        <SidekickRow label="Provider Resource ID" value={machine.provider_resource_id} copyable />
        <SidekickRow label="Terraform Workspace" value={machine.terraform_workspace} copyable />
        {machine.vpc_id && <SidekickRow label="VPC ID" value={machine.vpc_id} copyable />}
        {machine.subnet_id && <SidekickRow label="Subnet ID" value={machine.subnet_id} copyable />}
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Provider" value={machine.provider} />
        <SidekickRow label="Provider Account" value={machine.provider_account_id} />
        <SidekickRow label="Region" value={machine.region} />
        {machine.zone && <SidekickRow label="Zone" value={machine.zone} />}
        <SidekickRow label="Size" value={machine.size} />
        <SidekickRow label="Image" value={machine.image} copyable />
        {machine.os_name && <SidekickRow label="OS" value={machine.os_name} />}
      </SidekickSection>

      <SidekickSection title="Network">
        <SidekickRow label="Public IP" value={machine.public_ip} copyable />
        <SidekickRow label="Private IP" value={machine.private_ip} copyable />
      </SidekickSection>

      <SidekickSection title="Status">
        <SidekickRow label="Desired Status" value={machine.desired_status} />
        <SidekickRow label="Actual Status" value={machine.actual_status} />
        <SidekickRow label="Terraform State" value={machine.terraform_state_status} />
        <SidekickRow label="Agent Status" value={machine.agent_status} />
        <SidekickRow label="Provisioning Method" value={machine.provisioning_method} />
      </SidekickSection>

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(machine.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(machine.updated_at), 'PPpp')} />
        {machine.last_health_check && (
          <SidekickRow label="Last Health Check" value={format(new Date(machine.last_health_check), 'PPpp')} />
        )}
      </SidekickSection>

      {machine.bootstrap_profile_id && (
        <SidekickSection title="Bootstrap">
          <SidekickRow label="Profile ID" value={machine.bootstrap_profile_id} copyable />
        </SidekickSection>
      )}

      {Object.keys(machine.tags).length > 0 && (
        <SidekickSection title="Tags (Raw)">
          <SidekickJson data={machine.tags} />
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}

