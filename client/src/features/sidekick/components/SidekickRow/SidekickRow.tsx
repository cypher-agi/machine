import type { ReactNode } from 'react';
import { Copy } from 'lucide-react';
import clsx from 'clsx';
import { copyToClipboard } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import styles from './SidekickRow.module.css';

export interface SidekickRowProps {
  label: string;
  value?: string | ReactNode | null;
  icon?: ReactNode;
  accent?: boolean;
  copyable?: boolean;
  mono?: boolean;
  /** Max characters before middle truncation kicks in */
  maxLength?: number;
  /** Optional action button to display at the end of the row */
  action?: ReactNode;
}

/** Truncate string in the middle with ellipsis */
function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const charsToShow = maxLength - 3; // account for "..."
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);
  return `${str.slice(0, frontChars)}...${str.slice(-backChars)}`;
}

export function SidekickRow({
  label,
  value,
  icon,
  accent,
  copyable,
  mono,
  maxLength = 22,
  action,
}: SidekickRowProps) {
  const { addToast } = useAppStore();

  const isStringValue = typeof value === 'string';

  const handleCopy = async () => {
    if (isStringValue && value) {
      await copyToClipboard(value);
      addToast({ type: 'info', title: 'Copied', message: `${label} copied` });
    }
  };

  const displayValue = isStringValue && value ? truncateMiddle(value, maxLength) : value;

  return (
    <div className={styles['row']}>
      <span className={styles['label']}>
        {icon}
        {label}
      </span>
      {copyable && isStringValue && value ? (
        <div className={styles['valueCopyable']}>
          <span
            className={clsx(
              styles['value'],
              accent && styles['valueAccent'],
              mono && styles['valueMono']
            )}
            title={value}
          >
            {displayValue}
          </span>
          <button onClick={handleCopy} className={styles['copyButton']}>
            <Copy size={12} />
          </button>
        </div>
      ) : action ? (
        <div className={styles['valueWithAction']}>
          <span
            className={clsx(
              styles['value'],
              accent && styles['valueAccent'],
              mono && styles['valueMono']
            )}
            title={isStringValue ? value || undefined : undefined}
          >
            {displayValue || '—'}
          </span>
          {action}
        </div>
      ) : (
        <span
          className={clsx(
            styles['value'],
            accent && styles['valueAccent'],
            mono && styles['valueMono']
          )}
          title={isStringValue ? value || undefined : undefined}
        >
          {displayValue || '—'}
        </span>
      )}
    </div>
  );
}
