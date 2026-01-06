import { ReactNode } from 'react';
import { Copy } from 'lucide-react';
import clsx from 'clsx';
import { copyToClipboard } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import styles from '../../Sidekick/Sidekick.module.css';

export interface SidekickRowProps {
  label: string;
  value?: string | null;
  icon?: ReactNode;
  accent?: boolean;
  copyable?: boolean;
}

export function SidekickRow({ label, value, icon, accent, copyable }: SidekickRowProps) {
  const { addToast } = useAppStore();

  const handleCopy = async () => {
    if (value) {
      await copyToClipboard(value);
      addToast({ type: 'info', title: 'Copied', message: `${label} copied` });
    }
  };

  return (
    <div className={styles.row}>
      <span className={styles.label}>
        {icon}
        {label}
      </span>
      {copyable && value ? (
        <div className={styles.valueCopyable}>
          <span className={clsx(styles.value, accent && styles.valueAccent)} title={value}>
            {value}
          </span>
          <button onClick={handleCopy} className={styles.copyButton}>
            <Copy size={12} />
          </button>
        </div>
      ) : (
        <span className={clsx(styles.value, accent && styles.valueAccent)} title={value || undefined}>
          {value || '—'}
        </span>
      )}
    </div>
  );
}

