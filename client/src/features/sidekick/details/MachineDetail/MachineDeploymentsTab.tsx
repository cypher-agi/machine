import { formatDistanceToNow } from 'date-fns';
import type { Deployment } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { Badge } from '@/shared';
import { DEPLOYMENT_STATE_BADGE_CONFIG, DEPLOYMENT_TYPE_FULL_LABELS } from '@/shared/constants';
import { SidekickPanel, SidekickEmpty } from '../../components';
import styles from './MachineDetail.module.css';

interface MachineDeploymentsTabProps {
  deployments: Deployment[];
}

export function MachineDeploymentsTab({ deployments }: MachineDeploymentsTabProps) {
  const { setSidekickSelection } = useAppStore();

  if (!deployments.length) {
    return <SidekickEmpty message="No deployments" />;
  }

  const handleDeploymentClick = (deploymentId: string) => {
    setSidekickSelection({ type: 'deployment', id: deploymentId });
  };

  return (
    <SidekickPanel>
      {deployments.slice(0, 10).map((deployment) => {
        const state = DEPLOYMENT_STATE_BADGE_CONFIG[deployment.state];
        return (
          <div
            key={deployment.deployment_id}
            className={styles.cardClickable}
            onClick={() => handleDeploymentClick(deployment.deployment_id)}
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardInfo}>
                <div className={styles.cardTitle}>
                  <span className={styles.cardName}>
                    {DEPLOYMENT_TYPE_FULL_LABELS[deployment.type]}
                  </span>
                  <Badge variant={state.variant} size="sm">
                    {state.label}
                  </Badge>
                </div>
                <span className={styles.cardMeta}>
                  {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </SidekickPanel>
  );
}
