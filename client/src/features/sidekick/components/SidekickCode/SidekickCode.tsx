import styles from './SidekickCode.module.css';

export interface SidekickCodeProps {
  children: string;
}

export function SidekickCode({ children }: SidekickCodeProps) {
  return <pre className={styles.codeBlock}>{children}</pre>;
}
