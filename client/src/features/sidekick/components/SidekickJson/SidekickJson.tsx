import styles from './SidekickJson.module.css';

export interface SidekickJsonProps {
  data: unknown;
}

export function SidekickJson({ data }: SidekickJsonProps) {
  return <pre className={styles.jsonPreview}>{JSON.stringify(data, null, 2)}</pre>;
}

