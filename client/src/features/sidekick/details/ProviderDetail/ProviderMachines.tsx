import { useAppStore } from '@/store/appStore';
import { Badge } from '@/shared/ui';
import type { Machine } from '@machina/shared';
import {
  SidekickPanel,
  SidekickEmpty,
} from '../../components';
import styles from './ProviderDetail.module.css';

export interface ProviderMachinesProps {
  machines: Machine[];
}

export function ProviderMachines({ machines }: ProviderMachinesProps) {
  const { setSidekickSelection } = useAppStore();

  if (!machines.length) {
    return <SidekickEmpty message="No machines using this provider" />;
  }

  return (
    <SidekickPanel>
      {machines.map((machine) => (
        <div 
          key={machine.machine_id} 
          className={styles.cardClickable}
          onClick={() => setSidekickSelection({ type: 'machine', id: machine.machine_id })}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>
                <span className={styles.cardNameMono}>
                  {machine.name}
                </span>
                <Badge variant={machine.actual_status === 'running' ? 'running' : 'stopped'}>
                  {machine.actual_status}
                </Badge>
              </div>
              <span className={styles.cardMeta}>
                {machine.region} · {machine.size}
              </span>
            </div>
          </div>
        </div>
      ))}
    </SidekickPanel>
  );
}

