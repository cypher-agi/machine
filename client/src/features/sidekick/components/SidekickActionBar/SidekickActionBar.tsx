import { ReactNode } from 'react';
import clsx from 'clsx';
import styles from '../../Sidekick/Sidekick.module.css';

export interface SidekickActionBarProps {
  children: ReactNode;
  spread?: boolean;
}

export function SidekickActionBar({ children, spread }: SidekickActionBarProps) {
  return (
    <div className={clsx(styles.actionBar, spread && styles.actionBarSpread)}>
      {children}
    </div>
  );
}

