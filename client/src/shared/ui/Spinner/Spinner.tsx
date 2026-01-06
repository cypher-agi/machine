import clsx from 'clsx';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={clsx(
        styles.spinner,
        size === 'sm' && styles.spinnerSm,
        size === 'lg' && styles.spinnerLg,
        className
      )}
    />
  );
}

export interface PageLoaderProps {
  message?: string;
}

/** Full-page loading state for route transitions */
export function PageLoader({ message }: PageLoaderProps) {
  return (
    <div className={styles.pageLoader}>
      <Spinner size="lg" />
      {message && <span className={styles.message}>{message}</span>}
    </div>
  );
}

