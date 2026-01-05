import { useState } from 'react';
import { 
  GitBranch, 
  Clock, 
  Check, 
  X, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Play,
  StopCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';
import type { Deployment, DeploymentState, DeploymentType } from '@machine/shared';
import { DeploymentLogsModal } from './DeploymentLogsModal';

interface InspectorDeploymentsProps {
  machineId: string;
  deployments: Deployment[];
}

const stateConfig: Record<DeploymentState, { icon: typeof Check; class: string; label: string }> = {
  queued: { icon: Clock, class: 'text-text-tertiary', label: 'Queued' },
  planning: { icon: Loader2, class: 'text-status-provisioning animate-spin', label: 'Planning' },
  awaiting_approval: { icon: AlertCircle, class: 'text-status-warning', label: 'Awaiting Approval' },
  applying: { icon: Loader2, class: 'text-status-provisioning animate-spin', label: 'Applying' },
  succeeded: { icon: Check, class: 'text-status-running', label: 'Succeeded' },
  failed: { icon: X, class: 'text-status-error', label: 'Failed' },
  cancelled: { icon: StopCircle, class: 'text-text-tertiary', label: 'Cancelled' },
};

const typeLabels: Record<DeploymentType, string> = {
  create: 'Create',
  update: 'Update',
  destroy: 'Destroy',
  reboot: 'Reboot',
  restart_service: 'Restart Service',
  refresh: 'Refresh',
};

export function InspectorDeployments({ machineId, deployments }: InspectorDeploymentsProps) {
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  if (deployments.length === 0) {
    return (
      <div className="p-4">
        <div className="card flex flex-col items-center justify-center py-8">
          <GitBranch className="w-8 h-8 text-text-tertiary mb-2" />
          <p className="text-text-secondary">No deployments yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {deployments.map((deployment) => {
        const state = stateConfig[deployment.state] || stateConfig.queued;
        const StateIcon = state.icon;

        return (
          <button
            key={deployment.deployment_id}
            onClick={() => setSelectedDeployment(deployment)}
            className="w-full card hover:border-machine-border-light transition-colors text-left group"
          >
            <div className="flex items-start gap-3">
              <div className={clsx('mt-0.5', state.class)}>
                <StateIcon className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-text-primary">
                    {typeLabels[deployment.type]}
                  </span>
                  <span className={clsx('text-xs', state.class)}>
                    {state.label}
                  </span>
                </div>
                
                <div className="text-sm text-text-secondary">
                  <span>
                    {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                  </span>
                  {deployment.initiated_by && (
                    <span className="ml-2">
                      by <span className="text-text-primary">{deployment.initiated_by}</span>
                    </span>
                  )}
                </div>

                {/* Plan summary */}
                {deployment.plan_summary && (
                  <div className="mt-2 flex items-center gap-3 text-xs font-mono">
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
                  <div className="mt-2 text-sm text-status-error bg-status-error/10 px-2 py-1 rounded">
                    {deployment.error_message}
                  </div>
                )}
              </div>

              <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-text-secondary transition-colors" />
            </div>
          </button>
        );
      })}

      {/* Deployment logs modal */}
      {selectedDeployment && (
        <DeploymentLogsModal
          deployment={selectedDeployment}
          onClose={() => setSelectedDeployment(null)}
        />
      )}
    </div>
  );
}



