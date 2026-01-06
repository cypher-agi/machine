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

