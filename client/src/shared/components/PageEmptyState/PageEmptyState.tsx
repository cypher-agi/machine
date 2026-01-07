import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './PageEmptyState.module.css';

export interface PageEmptyStateProps {
  /** Icon to display */
  icon?: ReactNode;
  /** Main title */
  title?: string;
  /** Description text */
  description?: string;
  /** Action buttons */
  actions?: ReactNode;
  /** Use larger variant */
  large?: boolean;
}

export function PageEmptyState({
  icon,
  title,
  description,
  actions,
  large = false,
}: PageEmptyStateProps) {
  return (
    <div className={clsx(styles.emptyState, large && styles.emptyStateLarge)}>
      <div className={styles.emptyContent}>
        {icon && <div className={large ? styles.emptyIcon : styles.emptyIconSimple}>{icon}</div>}
        <div className={styles.emptyText}>
          {title && <h3 className={styles.emptyTitle}>{title}</h3>}
          {description && <p className={styles.emptyDesc}>{description}</p>}
        </div>
        {actions && <div className={styles.emptyActions}>{actions}</div>}
      </div>
    </div>
  );
}
