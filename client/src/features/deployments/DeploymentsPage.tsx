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
import clsx from 'clsx';
import { getDeployments, getMachines } from '@/lib/api';
import { Button, Select } from '@/shared/ui';
import type { DeploymentState, DeploymentType } from '@machine/shared';
import styles from './DeploymentsPage.module.css';

const stateConfig: Record<DeploymentState, { icon: typeof Check; className: string }> = {
  queued: { icon: Clock, className: styles.stateQueued },
  planning: { icon: Loader2, className: styles.statePlanning },
  awaiting_approval: { icon: AlertCircle, className: styles.stateAwaitingApproval },
  applying: { icon: Loader2, className: styles.stateApplying },
  succeeded: { icon: Check, className: styles.stateSucceeded },
  failed: { icon: X, className: styles.stateFailed },
  cancelled: { icon: StopCircle, className: styles.stateCancelled },
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

              return (
                <div key={deployment.deployment_id} className={styles.row}>
                  <div className={clsx(styles.stateIcon, state.className)}>
                    <StateIcon size={16} className={isInProgress ? 'animate-spin' : ''} />
                  </div>

                  <div className={styles.info}>
                    <div className={styles.infoTop}>
                      <span className={styles.type}>{typeLabels[deployment.type]}</span>
                      <span className={clsx(styles.state, state.className)}>
                        {deployment.state.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className={styles.meta}>
                      <span className={styles.machineName}>{getMachineName(deployment.machine_id)}</span>
                      <span>{formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}</span>
                      {deployment.initiated_by && <span>by {deployment.initiated_by}</span>}
                    </div>
                  </div>

                  {/* Plan summary */}
                  {deployment.plan_summary && (
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
                  )}

                  <div className={styles.deploymentId}>
                    {deployment.deployment_id.substring(0, 8)}
                  </div>
                </div>
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
