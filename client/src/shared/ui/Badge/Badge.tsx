import React from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

export type BadgeVariant = 'running' | 'stopped' | 'error' | 'pending' | 'provisioning';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ variant, pulse = false, className, children, ...props }) => {
  return (
    <span className={clsx(styles.badge, styles[variant], pulse && styles.pulse, className)} {...props}>
      {pulse && <span className={styles.dot} />}
      {children}
    </span>
  );
};
