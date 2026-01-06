import styles from '../../Sidekick/Sidekick.module.css';

export interface SidekickTagsProps {
  tags: Record<string, string> | string[];
}

export function SidekickTags({ tags }: SidekickTagsProps) {
  if (Array.isArray(tags)) {
    return (
      <div className={styles.tags}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            <span className={styles.tagSimple}>{tag}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.tags}>
      {Object.entries(tags).map(([key, value]) => (
        <span key={key} className={styles.tag}>
          <span className={styles.tagKey}>{key}:</span>
          <span className={styles.tagValue}>{value}</span>
        </span>
      ))}
    </div>
  );
}

