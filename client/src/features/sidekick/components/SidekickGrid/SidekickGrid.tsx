import { ReactNode } from 'react';
import styles from '../../Sidekick/Sidekick.module.css';

export interface SidekickGridProps {
  children: ReactNode;
}

export function SidekickGrid({ children }: SidekickGridProps) {
  return <div className={styles.grid}>{children}</div>;
}

export interface SidekickGridItemProps {
  label: string;
  value: string;
  icon?: ReactNode;
}

export function SidekickGridItem({ label, value, icon }: SidekickGridItemProps) {
  return (
    <div className={styles.gridItem}>
      <div className={styles.gridLabel}>
        {icon}
        <span>{label}</span>
      </div>
      <span className={styles.gridValue}>{value}</span>
    </div>
  );
}

