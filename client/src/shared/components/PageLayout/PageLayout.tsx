import { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './PageLayout.module.css';

export interface PageLayoutProps {
  /** Page title */
  title: string;
  /** Item count to display next to title */
  count?: number;
  /** Actions to render in header right side (buttons, filters, etc.) */
  actions?: ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Loading text to display */
  loadingText?: string;
  /** Main content */
  children: ReactNode;
  /** Additional className for the page container */
  className?: string;
}

export function PageLayout({
  title,
  count,
  actions,
  isLoading = false,
  loadingText = 'Loading...',
  children,
  className,
}: PageLayoutProps) {
  return (
    <div className={clsx(styles.page, className)}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{title}</h1>
          {count !== undefined && <span className={styles.count}>{count}</span>}
        </div>
        {actions && <div className={styles.headerRight}>{actions}</div>}
      </header>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingText}>{loadingText}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ========== Sub-components for consistent empty states ==========

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
        {icon && (
          <div className={large ? styles.emptyIcon : styles.emptyIconSimple}>
            {icon}
          </div>
        )}
        <div className={styles.emptyText}>
          {title && <h3 className={styles.emptyTitle}>{title}</h3>}
          {description && <p className={styles.emptyDesc}>{description}</p>}
        </div>
        {actions && <div className={styles.emptyActions}>{actions}</div>}
      </div>
    </div>
  );
}

// Simple list container
export function PageList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}

