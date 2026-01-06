import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Check, 
  X, 
  Clock, 
  Loader2, 
  AlertCircle, 
  StopCircle,
  Server,
  User,
  FileText,
  Terminal
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getDeployments, getMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Badge } from '@/shared/ui';
import type { DeploymentState, DeploymentType, Deployment } from '@machina/shared';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickContentFull,
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickLoading,
  SidekickFullCode,
  SidekickEmpty,
} from '../../Sidekick';
import styles from '../../Sidekick/Sidekick.module.css';

interface DeploymentDetailProps {
  deploymentId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

const stateConfig: Record<DeploymentState, { icon: typeof Check; label: string; variant: 'running' | 'stopped' | 'provisioning' | 'pending' | 'error' }> = {
  queued: { icon: Clock, label: 'Queued', variant: 'pending' },
  planning: { icon: Loader2, label: 'Planning', variant: 'provisioning' },
  awaiting_approval: { icon: AlertCircle, label: 'Awaiting Approval', variant: 'pending' },
  applying: { icon: Loader2, label: 'Applying', variant: 'provisioning' },
  succeeded: { icon: Check, label: 'Succeeded', variant: 'running' },
  failed: { icon: X, label: 'Failed', variant: 'error' },
  cancelled: { icon: StopCircle, label: 'Cancelled', variant: 'stopped' },
};

const typeLabels: Record<DeploymentType, string> = {
  create: 'Create Machine',
  update: 'Update Machine',
  destroy: 'Destroy Machine',
  reboot: 'Reboot Machine',
  restart_service: 'Restart Service',
  refresh: 'Refresh State',
};

type TabId = 'overview' | 'plan' | 'logs' | 'details';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Plan' },
  { id: 'logs', label: 'Logs' },
  { id: 'details', label: 'Details' },
];

export function DeploymentDetail({ deploymentId, onClose, onMinimize }: DeploymentDetailProps) {
  const { setSidekickSelection } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: deployments, isLoading } = useQuery({
    queryKey: ['deployments'],
    queryFn: () => getDeployments(),
    refetchInterval: 5000,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => getMachines(),
  });

  const deployment = deployments?.find((d) => d.deployment_id === deploymentId);

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!deployment) {
    return <SidekickLoading message="Deployment not found" />;
  }

  const state = stateConfig[deployment.state];
  const StateIcon = state.icon;
  const machine = machines?.find((m) => m.machine_id === deployment.machine_id);
  const isInProgress = deployment.state === 'planning' || deployment.state === 'applying';

  return (
    <>
      <SidekickHeader
        icon={<StateIcon size={18} className={isInProgress ? 'animate-spin' : ''} />}
        name={typeLabels[deployment.type]}
        nameSans
        subtitle={machine?.name || deployment.machine_id?.substring(0, 12) || 'Unknown Machine'}
        statusBadge={<Badge variant={state.variant}>{state.label}</Badge>}
        onClose={onClose}
        onMinimize={onMinimize}
      />

      <SidekickTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <SidekickContent>
        {activeTab === 'overview' && (
          <DeploymentOverview 
            deployment={deployment} 
            machine={machine}
            onMachineClick={() => {
              if (deployment.machine_id) {
                setSidekickSelection({ type: 'machine', id: deployment.machine_id });
              }
            }}
          />
        )}
        {activeTab === 'plan' && (
          <DeploymentPlan deployment={deployment} />
        )}
        {activeTab === 'logs' && (
          <DeploymentLogs deployment={deployment} />
        )}
        {activeTab === 'details' && (
          <DeploymentDetails deployment={deployment} />
        )}
      </SidekickContent>
    </>
  );
}

function DeploymentOverview({ 
  deployment, 
  machine,
  onMachineClick 
}: { 
  deployment: Deployment; 
  machine?: any;
  onMachineClick: () => void;
}) {
  const state = stateConfig[deployment.state];

  return (
    <SidekickPanel>
      <SidekickSection title="Status">
        <SidekickRow 
          label="State" 
          value={state.label}
        />
        <SidekickRow 
          label="Type" 
          value={typeLabels[deployment.type]}
        />
        <SidekickRow 
          label="Started" 
          value={formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
          icon={<Clock size={12} />}
        />
        {deployment.completed_at && (
          <SidekickRow 
            label="Completed" 
            value={formatDistanceToNow(new Date(deployment.completed_at), { addSuffix: true })}
          />
        )}
      </SidekickSection>

      {machine && (
        <SidekickSection title="Machine">
          <div 
            className={styles.cardClickable} 
            onClick={onMachineClick}
          >
            <div className={styles.cardHeader}>
              <Server size={16} className={styles.cardIconSecondary} />
              <div className={styles.cardInfo}>
                <span className={styles.cardNameMono}>
                  {machine.name}
                </span>
                <span className={styles.cardMeta}>
                  {machine.region} · {machine.size}
                </span>
              </div>
            </div>
          </div>
        </SidekickSection>
      )}

      {deployment.plan_summary && (
        <SidekickSection title="Plan Summary">
          <SidekickRow 
            label="To Add" 
            value={deployment.plan_summary.resources_to_add.toString()}
          />
          <SidekickRow 
            label="To Change" 
            value={deployment.plan_summary.resources_to_change.toString()}
          />
          <SidekickRow 
            label="To Destroy" 
            value={deployment.plan_summary.resources_to_destroy.toString()}
          />
        </SidekickSection>
      )}

      {deployment.initiated_by && (
        <SidekickSection title="Initiated By">
          <SidekickRow 
            label="User" 
            value={deployment.initiated_by}
            icon={<User size={12} />}
          />
        </SidekickSection>
      )}

      {deployment.error_message && (
        <SidekickSection title="Error">
          <div className={styles.errorBox}>
            {deployment.error_message}
          </div>
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}

function DeploymentPlan({ deployment }: { deployment: Deployment }) {
  if (!deployment.terraform_plan) {
    return <SidekickEmpty icon={<FileText size={32} />} message="No plan output available" />;
  }

  return (
    <SidekickContentFull>
      <SidekickFullCode language="hcl" title="Terraform Plan">
        {deployment.terraform_plan}
      </SidekickFullCode>
    </SidekickContentFull>
  );
}

function DeploymentLogs({ deployment }: { deployment: Deployment }) {
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs are displayed or updated
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [deployment.logs]);

  if (!deployment.logs || deployment.logs.length === 0) {
    return <SidekickEmpty icon={<Terminal size={32} />} message="No logs available" />;
  }

  return (
    <SidekickPanel>
      <SidekickSection title="Logs">
        <div ref={logsContainerRef} className={styles.logsContainer}>
          {deployment.logs.map((log, index) => (
            <div key={index} className={styles.logEntry}>
              <span className={styles.logTimestamp}>
                {format(new Date(log.timestamp), 'HH:mm:ss')}
              </span>
              <span className={`${styles.logLevel} ${styles[`logLevel${log.level}`]}`}>
                {log.level}
              </span>
              <span className={styles.logMessage}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </SidekickSection>
    </SidekickPanel>
  );
}

function DeploymentDetails({ deployment }: { deployment: Deployment }) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="Deployment ID" value={deployment.deployment_id} copyable />
        <SidekickRow label="Machine ID" value={deployment.machine_id} copyable />
        {deployment.terraform_workspace && (
          <SidekickRow label="Terraform Workspace" value={deployment.terraform_workspace} copyable />
        )}
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Type" value={deployment.type} />
        <SidekickRow label="State" value={deployment.state} />
        {deployment.initiated_by && (
          <SidekickRow label="Initiated By" value={deployment.initiated_by} />
        )}
      </SidekickSection>

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(deployment.created_at), 'PPpp')} />
        {deployment.started_at && (
          <SidekickRow label="Started At" value={format(new Date(deployment.started_at), 'PPpp')} />
        )}
        {deployment.completed_at && (
          <SidekickRow label="Completed At" value={format(new Date(deployment.completed_at), 'PPpp')} />
        )}
      </SidekickSection>

      {deployment.plan_summary && (
        <SidekickSection title="Plan Summary (Raw)">
          <div className={styles.row}>
            <span className={styles.label}>Resources to Add</span>
            <span className={`${styles.value} ${styles.statusSuccess}`}>
              +{deployment.plan_summary.resources_to_add}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Resources to Change</span>
            <span className={`${styles.value} ${styles.statusWarning}`}>
              ~{deployment.plan_summary.resources_to_change}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Resources to Destroy</span>
            <span className={`${styles.value} ${styles.statusError}`}>
              -{deployment.plan_summary.resources_to_destroy}
            </span>
          </div>
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}

