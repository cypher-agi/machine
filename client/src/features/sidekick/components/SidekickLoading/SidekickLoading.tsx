import styles from './SidekickLoading.module.css';

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

