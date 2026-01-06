import { ReactNode } from 'react';
import { X, Copy, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { copyToClipboard } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import styles from '../../Sidekick/Sidekick.module.css';

export interface SidekickHeaderProps {
  icon?: ReactNode;
  iconText?: string;
  name: string;
  nameSans?: boolean;
  subtitle?: string;
  statusBadge?: ReactNode;
  onClose: () => void;
  onMinimize?: () => void;
  quickCode?: string;
  quickCodeLabel?: string;
  quickActions?: ReactNode;
}

export function SidekickHeader({
  icon,
  iconText,
  name,
  nameSans,
  subtitle,
  statusBadge,
  onClose,
  onMinimize,
  quickCode,
  quickCodeLabel,
  quickActions,
}: SidekickHeaderProps) {
  const { addToast } = useAppStore();

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    addToast({ type: 'info', title: 'Copied', message: `${label} copied` });
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        {(icon || iconText) && (
          <div className={styles.headerIcon}>
            {iconText ? (
              <span className={styles.headerIconText}>{iconText}</span>
            ) : (
              <span className={styles.headerIconSvg}>{icon}</span>
            )}
          </div>
        )}
        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <h2 className={clsx(styles.name, nameSans && styles.nameSans)}>{name}</h2>
            {statusBadge}
          </div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.headerButtons}>
          {onMinimize && (
            <button 
              onClick={onMinimize} 
              className={styles.headerButton}
              title="Minimize"
            >
              <ChevronRight size={16} />
            </button>
          )}
          <button onClick={onClose} className={styles.closeButton} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {(quickCode || quickActions) && (
        <div className={styles.quickActions}>
          {quickCode && (
            <>
              <code className={styles.quickCode}>{quickCode}</code>
              <button
                onClick={() => handleCopy(quickCode, quickCodeLabel || 'Value')}
                className={styles.copyButton}
                title="Copy"
              >
                <Copy size={14} />
              </button>
            </>
          )}
          {quickActions}
        </div>
      )}
    </div>
  );
}

