import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  RefreshCw, 
  Check, 
  X, 
  Clock, 
  Sparkles,
  AlertCircle,
  StopCircle,
  GitBranch
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { getDeployments, getMachines } from '@/lib/api';
import type { DeploymentState, DeploymentType } from '@machine/shared';

const stateConfig: Record<DeploymentState, { icon: typeof Check; class: string; bgClass: string; shimmer?: boolean }> = {
  queued: { icon: Clock, class: 'text-text-tertiary', bgClass: 'bg-machine-elevated' },
  planning: { icon: Sparkles, class: 'text-status-provisioning', bgClass: 'bg-status-provisioning/10', shimmer: true },
  awaiting_approval: { icon: AlertCircle, class: 'text-status-warning', bgClass: 'bg-status-warning/10' },
  applying: { icon: Sparkles, class: 'text-status-provisioning', bgClass: 'bg-status-provisioning/10', shimmer: true },
  succeeded: { icon: Check, class: 'text-status-running', bgClass: 'bg-status-running/10' },
  failed: { icon: X, class: 'text-status-error', bgClass: 'bg-status-error/10' },
  cancelled: { icon: StopCircle, class: 'text-text-tertiary', bgClass: 'bg-machine-elevated' },
};

const typeLabels: Record<DeploymentType, string> = {
  create: 'Create',
  update: 'Update',
  destroy: 'Destroy',
  reboot: 'Reboot',
  restart_service: 'Restart Service',
  refresh: 'Refresh',
};

export function DeploymentsPage() {
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-machine-border bg-black px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-text-primary">Deployments</h1>
          <span className="text-sm text-text-tertiary font-mono">
            {deployments?.length ?? 0} total
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* State filter */}
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value as DeploymentState | '')}
            className="input w-36"
          >
            <option value="">All states</option>
            <option value="queued">Queued</option>
            <option value="planning">Planning</option>
            <option value="applying">Applying</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DeploymentType | '')}
            className="input w-36"
          >
            <option value="">All types</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="destroy">Destroy</option>
            <option value="reboot">Reboot</option>
            <option value="restart_service">Restart Service</option>
          </select>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn btn-ghost btn-icon"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-text-secondary animate-pulse">Loading deployments...</span>
          </div>
        ) : deployments && deployments.length > 0 ? (
          <div className="space-y-3">
            {deployments.map((deployment, index) => {
              const state = stateConfig[deployment.state];
              const StateIcon = state.icon;

              return (
                <div 
                  key={deployment.deployment_id} 
                  className="card animate-slide-in-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={clsx('p-2.5 rounded-xl', state.bgClass)}>
                      <StateIcon className={clsx('w-5 h-5', state.class)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-text-primary">
                          {typeLabels[deployment.type]}
                        </span>
                        <span className={clsx(
                          'text-sm font-medium',
                          state.class,
                          state.shimmer && 'animate-shimmer'
                        )}>
                          {deployment.state.replace(/_/g, ' ')}
                          {state.shimmer && <span className="animate-dots"><span>.</span><span>.</span><span>.</span></span>}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-text-secondary mb-2">
                        <span className="font-mono">{getMachineName(deployment.machine_id)}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}</span>
                        {deployment.initiated_by && (
                          <>
                            <span>•</span>
                            <span>by {deployment.initiated_by}</span>
                          </>
                        )}
                      </div>

                      {/* Plan summary */}
                      {deployment.plan_summary && (
                        <div className="flex items-center gap-3 text-xs font-mono">
                          {deployment.plan_summary.resources_to_add > 0 && (
                            <span className="text-status-running">
                              +{deployment.plan_summary.resources_to_add} add
                            </span>
                          )}
                          {deployment.plan_summary.resources_to_change > 0 && (
                            <span className="text-status-warning">
                              ~{deployment.plan_summary.resources_to_change} change
                            </span>
                          )}
                          {deployment.plan_summary.resources_to_destroy > 0 && (
                            <span className="text-status-error">
                              -{deployment.plan_summary.resources_to_destroy} destroy
                            </span>
                          )}
                        </div>
                      )}

                      {/* Error message */}
                      {deployment.error_message && (
                        <div className="mt-2 text-sm text-status-error bg-status-error/10 px-3 py-2 rounded-lg">
                          {deployment.error_message}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-xs text-text-tertiary">
                      <code className="font-mono">{deployment.deployment_id.substring(0, 16)}</code>
                      {deployment.finished_at && (
                        <p className="mt-1">
                          Duration: {Math.round((new Date(deployment.finished_at).getTime() - new Date(deployment.started_at || deployment.created_at).getTime()) / 1000)}s
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-machine-elevated border border-machine-border flex items-center justify-center">
                <GitBranch className="w-8 h-8 text-text-tertiary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary mb-1">No deployments found</h3>
                <p className="text-text-secondary">
                  {filterState || filterType
                    ? 'Try adjusting your filters.'
                    : 'Deployments will appear here when you create or modify machines.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

