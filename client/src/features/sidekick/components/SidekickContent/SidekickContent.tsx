import { ReactNode } from 'react';
import styles from './SidekickContent.module.css';

export interface SidekickContentProps {
  children: ReactNode;
}

export function SidekickContent({ children }: SidekickContentProps) {
  return <div className={styles.tabContent}>{children}</div>;
}

/** Full-height content container - used for template/code views */
export function SidekickContentFull({ children }: SidekickContentProps) {
  return <div className={styles.tabContentFull}>{children}</div>;
}
