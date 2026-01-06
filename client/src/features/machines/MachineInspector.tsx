import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Server, 
  GitBranch,
  Shield,
  Activity,
  FileText,
  Copy,
  Terminal
} from 'lucide-react';
import clsx from 'clsx';
import { 
  getMachine, 
  getMachineServices, 
  getMachineNetworking,
  getDeployments 
} from '@/lib/api';
import type { MachineStatus } from '@machine/shared';
import { InspectorOverview } from './inspector/InspectorOverview';
import { InspectorDeployments } from './inspector/InspectorDeployments';
import { InspectorNetworking } from './inspector/InspectorNetworking';
import { InspectorServices } from './inspector/InspectorServices';
import { InspectorDetails } from './inspector/InspectorDetails';
import { TerminalModal } from '@/components/terminal/TerminalModal';

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

const statusConfig: Record<MachineStatus, { label: string; class: string }> = {
  running: { label: 'Running', class: 'badge-running' },
  stopped: { label: 'Stopped', class: 'badge-stopped' },
  provisioning: { label: 'Provisioning', class: 'badge-provisioning' },
  pending: { label: 'Pending', class: 'badge-pending' },
  stopping: { label: 'Stopping', class: 'badge-pending' },
  rebooting: { label: 'Rebooting', class: 'badge-provisioning' },
  terminating: { label: 'Terminating', class: 'badge-error' },
  terminated: { label: 'Terminated', class: 'badge-stopped' },
  error: { label: 'Error', class: 'badge-error' },
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
      <div className="w-96 border-l border-cursor-border bg-cursor-bg flex items-center justify-center">
        <span className="text-sm text-text-muted">Loading...</span>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="w-96 border-l border-cursor-border bg-cursor-bg flex items-center justify-center">
        <span className="text-sm text-text-muted">Machine not found</span>
      </div>
    );
  }

  const status = statusConfig[machine.actual_status] || statusConfig.error;

  return (
    <div className="w-96 border-l border-cursor-border bg-cursor-bg flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-cursor-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-mono text-sm font-medium text-text-primary truncate">
                {machine.name}
              </h2>
              <span className={clsx('badge', status.class)}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {machine.provider.toUpperCase()} · {machine.region} · {machine.size}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick actions */}
        {machine.public_ip && (
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 font-mono text-xs text-text-secondary bg-cursor-surface px-2 py-1 rounded">
              {machine.public_ip}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(machine.public_ip!)}
              className="p-1 text-text-muted hover:text-text-secondary rounded transition-colors"
              title="Copy IP"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {machine.actual_status === 'running' && (
              <button
                onClick={() => setShowTerminal(true)}
                className="btn btn-primary btn-sm"
                title="SSH"
              >
                <Terminal className="w-3.5 h-3.5" />
                SSH
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-cursor-border">
        <div className="flex px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors border-b -mb-px',
                activeTab === tab.id
                  ? 'text-text-primary border-text-primary'
                  : 'text-text-muted hover:text-text-secondary border-transparent'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <InspectorOverview machine={machine} />
        )}
        {activeTab === 'deployments' && (
          <InspectorDeployments deployments={deployments || []} />
        )}
        {activeTab === 'networking' && (
          <InspectorNetworking networking={networking} />
        )}
        {activeTab === 'services' && (
          <InspectorServices machineId={machineId} services={services} />
        )}
        {activeTab === 'details' && (
          <InspectorDetails machine={machine} />
        )}
      </div>

      {/* Terminal Modal */}
      {showTerminal && (
        <TerminalModal
          machine={machine}
          onClose={() => setShowTerminal(false)}
        />
      )}
    </div>
  );
}
