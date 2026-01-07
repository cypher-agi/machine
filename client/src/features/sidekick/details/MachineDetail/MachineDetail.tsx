import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal } from 'lucide-react';
import { getMachine, getMachineServices, getMachineNetworking, getDeployments } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Badge, Button } from '@/shared/ui';
import { TerminalModal } from '@/features/terminal';
import { PROVIDER_LABELS, MACHINE_STATUS_CONFIG } from '@/shared/constants';
import { SidekickHeader, SidekickTabs, SidekickContent, SidekickLoading } from '../../components';
import { MachineOverviewTab } from './MachineOverviewTab';
import { MachineDeploymentsTab } from './MachineDeploymentsTab';
import { MachineNetworkingTab } from './MachineNetworkingTab';
import { MachineServicesTab } from './MachineServicesTab';
import { MachineDetailsTab } from './MachineDetailsTab';

export interface MachineDetailProps {
  machineId: string;
  onClose: () => void;
  onMinimize: () => void;
}

type TabId = 'overview' | 'deployments' | 'networking' | 'services' | 'details';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'deployments', label: 'Deploys' },
  { id: 'networking', label: 'Network' },
  { id: 'services', label: 'Services' },
  { id: 'details', label: 'Details' },
];

export function MachineDetail({ machineId, onClose, onMinimize }: MachineDetailProps) {
  const { currentTeamId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showTerminal, setShowTerminal] = useState(false);

  const { data: machine, isLoading } = useQuery({
    queryKey: ['machine', currentTeamId, machineId],
    queryFn: () => getMachine(machineId),
    refetchInterval: 5000,
  });

  const { data: services } = useQuery({
    queryKey: ['machine-services', currentTeamId, machineId],
    queryFn: () => getMachineServices(machineId),
    enabled: !!machine,
  });

  const { data: networking } = useQuery({
    queryKey: ['machine-networking', currentTeamId, machineId],
    queryFn: () => getMachineNetworking(machineId),
    enabled: !!machine,
  });

  const { data: deployments } = useQuery({
    queryKey: ['deployments', currentTeamId, { machine_id: machineId }],
    queryFn: () => getDeployments({ machine_id: machineId }),
    enabled: !!machine,
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!machine) {
    return <SidekickLoading message="Machine not found" />;
  }

  const status = MACHINE_STATUS_CONFIG[machine.actual_status] || MACHINE_STATUS_CONFIG.error;

  return (
    <>
      <SidekickHeader
        iconText={PROVIDER_LABELS[machine.provider] || '??'}
        name={machine.name}
        subtitle={`${machine.provider.toUpperCase()} · ${machine.region} · ${machine.size}`}
        statusBadge={<Badge variant={status.variant}>{status.label}</Badge>}
        onClose={onClose}
        onMinimize={onMinimize}
        {...(machine.public_ip
          ? { quickCode: machine.public_ip, quickCodeLabel: 'IP Address' }
          : {})}
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
        {activeTab === 'overview' && <MachineOverviewTab machine={machine} />}
        {activeTab === 'deployments' && <MachineDeploymentsTab deployments={deployments || []} />}
        {activeTab === 'networking' && <MachineNetworkingTab networking={networking} />}
        {activeTab === 'services' && <MachineServicesTab services={services} />}
        {activeTab === 'details' && <MachineDetailsTab machine={machine} />}
      </SidekickContent>

      {showTerminal && <TerminalModal machine={machine} onClose={() => setShowTerminal(false)} />}
    </>
  );
}
