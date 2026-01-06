import { ReactNode } from 'react';
import styles from './SidekickEmpty.module.css';

export interface SidekickEmptyProps {
  icon?: ReactNode;
  message: string;
}

export function SidekickEmpty({ icon, message }: SidekickEmptyProps) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <span className={styles.emptyText}>{message}</span>
    </div>
  );
}

