import { useEffect } from 'react';
import { X, Check, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import styles from './Toasts.module.css';

const iconMap = {
  success: Check,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Toasts() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  toast: {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
    duration?: number;
  };
  onClose: () => void;
}

function Toast({ toast, onClose }: ToastProps) {
  const Icon = iconMap[toast.type];
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={clsx(styles.toast, styles[toast.type])}>
      <Icon className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.title}>{toast.title}</p>
        {toast.message && (
          <p className={styles.message}>{toast.message}</p>
        )}
      </div>
      <button onClick={onClose} className={styles.closeButton}>
        <X size={14} />
      </button>
    </div>
  );
}
