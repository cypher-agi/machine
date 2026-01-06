import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Server, GitBranch, Shield, Activity, FileText, Copy, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { getMachine, getMachineServices, getMachineNetworking, getDeployments } from '@/lib/api';
import type { MachineStatus } from '@machina/shared';
import { Badge, Button } from '@/shared/ui';
import { InspectorOverview } from './inspector/InspectorOverview';
import { InspectorDeployments } from './inspector/InspectorDeployments';
import { InspectorNetworking } from './inspector/InspectorNetworking';
import { InspectorServices } from './inspector/InspectorServices';
import { InspectorDetails } from './inspector/InspectorDetails';
import { TerminalModal } from '../../components/terminal/TerminalModal';
import styles from './MachineInspector.module.css';

interface MachineInspectorProps {
  machineId: string;
  onClose: () => void;
}

type TabId = 'overview' | 'deployments' | 'networking' | 'services' | 'details';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Server;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: Server },
  { id: 'deployments', label: 'Deploys', icon: GitBranch },
  { id: 'networking', label: 'Network', icon: Shield },
  { id: 'services', label: 'Services', icon: Activity },
  { id: 'details', label: 'Details', icon: FileText },
];

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

export function MachineInspector({ machineId, onClose }: MachineInspectorProps) {
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
    return (
      <div className={styles.inspector}>
        <div className={styles.loading}>
          <span className={styles.loadingText}>Loading...</span>
        </div>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className={styles.inspector}>
        <div className={styles.loading}>
          <span className={styles.loadingText}>Machine not found</span>
        </div>
      </div>
    );
  }

  const status = statusConfig[machine.actual_status] || statusConfig.error;

  return (
    <div className={styles.inspector}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerInfo}>
            <div className={styles.nameRow}>
              <h2 className={styles.name}>{machine.name}</h2>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className={styles.subtitle}>
              {machine.provider.toUpperCase()} · {machine.region} · {machine.size}
            </p>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={16} />
          </button>
        </div>

        {/* Quick actions */}
        {machine.public_ip && (
          <div className={styles.quickActions}>
            <code className={styles.ipCode}>{machine.public_ip}</code>
            <button
              onClick={() => navigator.clipboard.writeText(machine.public_ip!)}
              className={styles.copyButton}
              title="Copy IP"
            >
              <Copy size={14} />
            </button>
            {machine.actual_status === 'running' && (
              <Button variant="primary" size="sm" onClick={() => setShowTerminal(true)}>
                <Terminal size={14} />
                SSH
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <div className={styles.tabList}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(styles.tab, activeTab === tab.id && styles.active)}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && <InspectorOverview machine={machine} />}
        {activeTab === 'deployments' && <InspectorDeployments deployments={deployments || []} />}
        {activeTab === 'networking' && <InspectorNetworking networking={networking} />}
        {activeTab === 'services' && <InspectorServices machineId={machineId} services={services} />}
        {activeTab === 'details' && <InspectorDetails machine={machine} />}
      </div>

      {/* Terminal Modal */}
      {showTerminal && (
        <TerminalModal machine={machine} onClose={() => setShowTerminal(false)} />
      )}
    </div>
  );
}
