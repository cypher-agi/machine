import type { ReactNode } from 'react';
import styles from './SidekickPanel.module.css';

export interface SidekickPanelProps {
  children: ReactNode;
}

export function SidekickPanel({ children }: SidekickPanelProps) {
  return <div className={styles.panel}>{children}</div>;
}
