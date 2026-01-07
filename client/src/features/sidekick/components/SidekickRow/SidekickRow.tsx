import type { ReactNode } from 'react';
import { Copy } from 'lucide-react';
import clsx from 'clsx';
import { copyToClipboard } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import styles from './SidekickRow.module.css';

export interface SidekickRowProps {
  label: string;
  value?: string | null;
  icon?: ReactNode;
  accent?: boolean;
  copyable?: boolean;
  mono?: boolean;
  /** Max characters before middle truncation kicks in */
  maxLength?: number;
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
}: SidekickRowProps) {
  const { addToast } = useAppStore();

  const handleCopy = async () => {
    if (value) {
      await copyToClipboard(value);
      addToast({ type: 'info', title: 'Copied', message: `${label} copied` });
    }
  };

  const displayValue = value ? truncateMiddle(value, maxLength) : null;

  return (
    <div className={styles.row}>
      <span className={styles.label}>
        {icon}
        {label}
      </span>
      {copyable && value ? (
        <div className={styles.valueCopyable}>
          <span
            className={clsx(styles.value, accent && styles.valueAccent, mono && styles.valueMono)}
            title={value}
          >
            {displayValue}
          </span>
          <button onClick={handleCopy} className={styles.copyButton}>
            <Copy size={12} />
          </button>
        </div>
      ) : (
        <span
          className={clsx(styles.value, accent && styles.valueAccent, mono && styles.valueMono)}
          title={value || undefined}
        >
          {displayValue || '—'}
        </span>
      )}
    </div>
  );
}
