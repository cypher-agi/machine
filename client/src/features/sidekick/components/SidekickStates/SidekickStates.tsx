import { ReactNode } from 'react';
import styles from '../../Sidekick/Sidekick.module.css';

export interface SidekickLoadingProps {
  message?: string;
}

export function SidekickLoading({ message = 'Loading...' }: SidekickLoadingProps) {
  return (
    <div className={styles.loading}>
      <span className={styles.loadingText}>{message}</span>
    </div>
  );
}

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

