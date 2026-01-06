import { useState } from 'react';
import { GitBranch, Clock, Check, X, AlertCircle, Sparkles, ChevronRight, StopCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { Deployment, DeploymentState, DeploymentType } from '@machina/shared';
import { DeploymentLogsModal } from './DeploymentLogsModal';
import styles from './Sidekick.module.css';

interface SidekickDeploymentsProps {
  deployments: Deployment[];
}

const stateConfig: Record<DeploymentState, { icon: typeof Check; className: string; label: string }> = {
  queued: { icon: Clock, className: styles.statusMuted, label: 'Queued' },
  planning: { icon: Sparkles, className: styles.statusSuccess, label: 'Planning' },
  awaiting_approval: { icon: AlertCircle, className: styles.statusWarning, label: 'Awaiting Approval' },
  applying: { icon: Sparkles, className: styles.statusSuccess, label: 'Applying' },
  succeeded: { icon: Check, className: styles.statusSuccess, label: 'Succeeded' },
  failed: { icon: X, className: styles.statusError, label: 'Failed' },
  cancelled: { icon: StopCircle, className: styles.statusMuted, label: 'Cancelled' },
};

const typeLabels: Record<DeploymentType, string> = {
  create: 'Create',
  update: 'Update',
  destroy: 'Destroy',
  reboot: 'Reboot',
  restart_service: 'Restart Service',
  refresh: 'Refresh',
};

export function SidekickDeployments({ deployments }: SidekickDeploymentsProps) {
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  if (deployments.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={clsx(styles.section, styles.emptyState)}>
          <GitBranch size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No deployments yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {deployments.map((deployment) => {
        const state = stateConfig[deployment.state] || stateConfig.queued;
        const StateIcon = state.icon;
        const isInProgress = deployment.state === 'planning' || deployment.state === 'applying';

        return (
          <button
            key={deployment.deployment_id}
            onClick={() => setSelectedDeployment(deployment)}
            className={styles.deploymentCard}
          >
            <div className={styles.deploymentHeader}>
              <StateIcon
                size={20}
                className={clsx(styles.deploymentIcon, state.className, isInProgress && 'animate-spin')}
              />

              <div className={styles.deploymentInfo}>
                <div className={styles.deploymentTitle}>
                  <span className={styles.deploymentType}>{typeLabels[deployment.type]}</span>
                  <span className={clsx(styles.deploymentState, state.className)}>{state.label}</span>
                </div>

                <div className={styles.deploymentMeta}>
                  <span>{formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}</span>
                  {deployment.initiated_by && <span> by {deployment.initiated_by}</span>}
                </div>

                {deployment.plan_summary && (
                  <div className={styles.deploymentStats}>
                    {deployment.plan_summary.resources_to_add > 0 && (
                      <span className={styles.statusSuccess}>+{deployment.plan_summary.resources_to_add} add</span>
                    )}
                    {deployment.plan_summary.resources_to_change > 0 && (
                      <span className={styles.statusWarning}>~{deployment.plan_summary.resources_to_change} change</span>
                    )}
                    {deployment.plan_summary.resources_to_destroy > 0 && (
                      <span className={styles.statusError}>-{deployment.plan_summary.resources_to_destroy} destroy</span>
                    )}
                  </div>
                )}

                {deployment.error_message && (
                  <div className={styles.deploymentError}>{deployment.error_message}</div>
                )}
              </div>

              <ChevronRight size={20} style={{ color: 'var(--color-text-muted)' }} />
            </div>
          </button>
        );
      })}

      {selectedDeployment && (
        <DeploymentLogsModal deployment={selectedDeployment} onClose={() => setSelectedDeployment(null)} />
      )}
    </div>
  );
}

