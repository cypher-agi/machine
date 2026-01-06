import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Copy, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { getMachine, getMachineServices, getMachineNetworking, getDeployments } from '@/lib/api';
import type { MachineStatus } from '@machina/shared';
import { Badge, Button, AnimatedTabs } from '@/shared/ui';
import { SidekickOverview } from './sidekick/SidekickOverview';
import { SidekickDeployments } from './sidekick/SidekickDeployments';
import { SidekickNetworking } from './sidekick/SidekickNetworking';
import { SidekickServices } from './sidekick/SidekickServices';
import { SidekickDetails } from './sidekick/SidekickDetails';
import { TerminalModal } from '../../components/terminal/TerminalModal';
import styles from './Sidekick.module.css';

interface SidekickProps {
  machineId: string;
  onClose: () => void;
  isClosing?: boolean;
  isOpening?: boolean;
}

type TabId = 'overview' | 'deployments' | 'networking' | 'services' | 'details';

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'deployments', label: 'Deploys' },
  { id: 'networking', label: 'Network' },
  { id: 'services', label: 'Services' },
  { id: 'details', label: 'Details' },
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

export function Sidekick({ machineId, onClose, isClosing, isOpening }: SidekickProps) {
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

  const sidekickClassName = clsx(
    styles.sidekick,
    isOpening && styles.sidekickOpening,
    isClosing && styles.sidekickClosing
  );

  if (isLoading) {
    return (
      <div className={sidekickClassName}>
        <div className={styles.loading}>
          <span className={styles.loadingText}>Loading...</span>
        </div>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className={sidekickClassName}>
        <div className={styles.loading}>
          <span className={styles.loadingText}>Machine not found</span>
        </div>
      </div>
    );
  }

  const status = statusConfig[machine.actual_status] || statusConfig.error;

  return (
    <div className={sidekickClassName}>
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
      <AnimatedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
        className={styles.tabs}
      />

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && <SidekickOverview machine={machine} />}
        {activeTab === 'deployments' && <SidekickDeployments deployments={deployments || []} />}
        {activeTab === 'networking' && <SidekickNetworking networking={networking} />}
        {activeTab === 'services' && <SidekickServices machineId={machineId} services={services} />}
        {activeTab === 'details' && <SidekickDetails machine={machine} />}
      </div>

      {/* Terminal Modal */}
      {showTerminal && (
        <TerminalModal machine={machine} onClose={() => setShowTerminal(false)} />
      )}
    </div>
  );
}

