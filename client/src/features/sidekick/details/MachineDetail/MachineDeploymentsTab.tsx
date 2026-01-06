import { formatDistanceToNow } from 'date-fns';
import type { Deployment } from '@machina/shared';
import {
  SidekickPanel,
  SidekickEmpty,
} from '../../components';
import styles from '../../Sidekick/Sidekick.module.css';

interface MachineDeploymentsTabProps {
  deployments: Deployment[];
}

export function MachineDeploymentsTab({ deployments }: MachineDeploymentsTabProps) {
  if (!deployments.length) {
    return <SidekickEmpty message="No deployments" />;
  }

  return (
    <SidekickPanel>
      {deployments.slice(0, 10).map((deployment) => (
        <div key={deployment.deployment_id} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>
                <span className={styles.cardName}>{deployment.type}</span>
                <span className={styles.cardState}>
                  {deployment.state}
                </span>
              </div>
              <span className={styles.cardMeta}>
                {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </SidekickPanel>
  );
}

