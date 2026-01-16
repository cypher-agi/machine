import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './CollapsibleGroup.module.css';

export interface CollapsibleGroupProps {
  /** The group label/title */
  label: string;
  /** Count to display next to the label */
  count?: number;
  /** Optional stats to display (aligned to the right) */
  stats?: ReactNode;
  /** Whether the group starts collapsed */
  defaultCollapsed?: boolean;
  /** The content to render inside the group */
  children: ReactNode;
  /** Optional className for the container */
  className?: string;
}

export function CollapsibleGroup({
  label,
  count,
  stats,
  defaultCollapsed = false,
  children,
  className,
}: CollapsibleGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`${styles.group} ${className || ''}`}>
      <button
        className={styles.header}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand' : 'Collapse'}
        type="button"
      >
        <span className={styles.label}>{label}</span>
        {count !== undefined && <span className={styles.count}>{count}</span>}
        {stats && <div className={styles.stats}>{stats}</div>}
        <span
          className={`${styles.toggle} ${isCollapsed ? styles.toggleCollapsed : ''} ${!stats ? styles.toggleNoStats : ''}`}
        >
          <ChevronDown size={16} />
        </span>
      </button>
      <div className={`${styles.content} ${isCollapsed ? styles.contentCollapsed : ''}`}>
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  );
}
