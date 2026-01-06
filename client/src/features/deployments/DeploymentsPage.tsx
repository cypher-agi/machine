import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  RefreshCw, 
  Check, 
  X, 
  Clock, 
  Loader2,
  AlertCircle,
  StopCircle,
  GitBranch
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getDeployments, getMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button, Select } from '@/shared/ui';
import { ItemCard, ItemCardMeta, ItemCardStatus } from '@/shared/components';
import type { DeploymentState, DeploymentType } from '@machina/shared';
import styles from './DeploymentsPage.module.css';

const stateConfig: Record<DeploymentState, { icon: typeof Check; variant: 'valid' | 'invalid' | 'warning' | 'muted' | 'pending' | 'provisioning'; label: string }> = {
  queued: { icon: Clock, variant: 'pending', label: 'Queued' },
  planning: { icon: Loader2, variant: 'provisioning', label: 'Planning' },
  awaiting_approval: { icon: AlertCircle, variant: 'warning', label: 'Awaiting' },
  applying: { icon: Loader2, variant: 'provisioning', label: 'Applying' },
  succeeded: { icon: Check, variant: 'valid', label: 'Succeeded' },
  failed: { icon: X, variant: 'invalid', label: 'Failed' },
  cancelled: { icon: StopCircle, variant: 'muted', label: 'Cancelled' },
};

const typeLabels: Record<DeploymentType, string> = {
  create: 'Create',
  update: 'Update',
  destroy: 'Destroy',
  reboot: 'Reboot',
  restart_service: 'Restart',
  refresh: 'Refresh',
};

function DeploymentsPage() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();
  const [filterState, setFilterState] = useState<DeploymentState | ''>('');
  const [filterType, setFilterType] = useState<DeploymentType | ''>('');

  const { data: deployments, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['deployments', { state: filterState || undefined, type: filterType || undefined }],
    queryFn: () => getDeployments({ 
      state: filterState || undefined, 
      type: filterType || undefined 
    }),
    refetchInterval: 5000,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => getMachines(),
  });

  const getMachineName = (machineId?: string) => {
    if (!machineId) return 'Unknown';
    return machines?.find(m => m.machine_id === machineId)?.name || machineId.substring(0, 12);
  };

  const handleSelectDeployment = (deploymentId: string) => {
    setSidekickSelection({ type: 'deployment', id: deploymentId });
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Deployments</h1>
          <span className={styles.count}>{deployments?.length ?? 0}</span>
        </div>

        <div className={styles.headerRight}>
          <Select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value as DeploymentState | '')}
            size="sm"
            className={styles.filterSelect}
          >
            <option value="">All states</option>
            <option value="queued">Queued</option>
            <option value="planning">Planning</option>
            <option value="applying">Applying</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DeploymentType | '')}
            size="sm"
            className={styles.filterSelect}
          >
            <option value="">All types</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="destroy">Destroy</option>
            <option value="reboot">Reboot</option>
            <option value="restart_service">Restart</option>
          </Select>

          <Button variant="ghost" size="sm" iconOnly onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingText}>Loading...</span>
          </div>
        ) : deployments && deployments.length > 0 ? (
          <div className={styles.list}>
            {deployments.map((deployment) => {
              const state = stateConfig[deployment.state];
              const StateIcon = state.icon;
              const isInProgress = deployment.state === 'planning' || deployment.state === 'applying';
              const isSelected = sidekickSelection?.type === 'deployment' && sidekickSelection?.id === deployment.deployment_id;

              return (
                <ItemCard
                  key={deployment.deployment_id}
                  selected={isSelected}
                  onClick={() => handleSelectDeployment(deployment.deployment_id)}
                  iconBadge={<StateIcon size={14} className={isInProgress ? 'animate-spin' : ''} />}
                  title={typeLabels[deployment.type]}
                  titleSans
                  statusBadge={
                    <ItemCardStatus variant={state.variant}>
                      {state.label}
                    </ItemCardStatus>
                  }
                  meta={
                    <>
                      <ItemCardMeta mono>
                        {getMachineName(deployment.machine_id)}
                      </ItemCardMeta>
                      <ItemCardMeta>
                        {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                      </ItemCardMeta>
                      {deployment.initiated_by && (
                        <ItemCardMeta>by {deployment.initiated_by}</ItemCardMeta>
                      )}
                    </>
                  }
                  secondary={
                    deployment.plan_summary && (
                      <div className={styles.planSummary}>
                        {deployment.plan_summary.resources_to_add > 0 && (
                          <span className={styles.planAdd}>+{deployment.plan_summary.resources_to_add}</span>
                        )}
                        {deployment.plan_summary.resources_to_change > 0 && (
                          <span className={styles.planChange}>~{deployment.plan_summary.resources_to_change}</span>
                        )}
                        {deployment.plan_summary.resources_to_destroy > 0 && (
                          <span className={styles.planDestroy}>-{deployment.plan_summary.resources_to_destroy}</span>
                        )}
                      </div>
                    )
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyContent}>
              <GitBranch className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                {filterState || filterType ? 'No matching deployments' : 'No deployments yet'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeploymentsPage;
