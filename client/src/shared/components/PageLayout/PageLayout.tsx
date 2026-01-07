import type { ReactNode } from 'react';
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
