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
import type { DeploymentState, DeploymentType } from '@machine/shared';

const stateConfig: Record<DeploymentState, { icon: typeof Check; class: string }> = {
  queued: { icon: Clock, class: 'text-text-muted' },
  planning: { icon: Loader2, class: 'text-accent-blue' },
  awaiting_approval: { icon: AlertCircle, class: 'text-status-warning' },
  applying: { icon: Loader2, class: 'text-accent-blue' },
  succeeded: { icon: Check, class: 'text-status-success' },
  failed: { icon: X, class: 'text-status-error' },
  cancelled: { icon: StopCircle, class: 'text-text-muted' },
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
    <div className="h-full flex flex-col bg-cursor-bg">
      {/* Header */}
      <header className="flex-shrink-0 h-12 border-b border-cursor-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-text-primary">Deployments</h1>
          <span className="text-xs text-text-muted font-mono">
            {deployments?.length ?? 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value as DeploymentState | '')}
            className="input w-28 h-7 text-xs"
          >
            <option value="">All states</option>
            <option value="queued">Queued</option>
            <option value="planning">Planning</option>
            <option value="applying">Applying</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DeploymentType | '')}
            className="input w-28 h-7 text-xs"
          >
            <option value="">All types</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="destroy">Destroy</option>
            <option value="reboot">Reboot</option>
            <option value="restart_service">Restart</option>
          </select>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn btn-ghost btn-icon"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-text-muted">Loading...</span>
          </div>
        ) : deployments && deployments.length > 0 ? (
          <div className="space-y-1">
            {deployments.map((deployment) => {
              const state = stateConfig[deployment.state];
              const StateIcon = state.icon;
              const isInProgress = deployment.state === 'planning' || deployment.state === 'applying';

              return (
                <div 
                  key={deployment.deployment_id} 
                  className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-cursor-surface transition-colors"
                >
                  <div className={clsx('w-5 h-5 flex items-center justify-center', state.class)}>
                    <StateIcon className={clsx('w-4 h-4', isInProgress && 'animate-spin')} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary font-medium">
                        {typeLabels[deployment.type]}
                      </span>
                      <span className={clsx('text-xs', state.class)}>
                        {deployment.state.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="font-mono">{getMachineName(deployment.machine_id)}</span>
                      <span>{formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}</span>
                      {deployment.initiated_by && (
                        <span>by {deployment.initiated_by}</span>
                      )}
                    </div>
                  </div>

                  {/* Plan summary */}
                  {deployment.plan_summary && (
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      {deployment.plan_summary.resources_to_add > 0 && (
                        <span className="text-status-success">
                          +{deployment.plan_summary.resources_to_add}
                        </span>
                      )}
                      {deployment.plan_summary.resources_to_change > 0 && (
                        <span className="text-status-warning">
                          ~{deployment.plan_summary.resources_to_change}
                        </span>
                      )}
                      {deployment.plan_summary.resources_to_destroy > 0 && (
                        <span className="text-status-error">
                          -{deployment.plan_summary.resources_to_destroy}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-text-muted font-mono">
                    {deployment.deployment_id.substring(0, 8)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <GitBranch className="w-6 h-6 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">
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
