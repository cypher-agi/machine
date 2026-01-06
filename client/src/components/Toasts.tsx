import { useEffect } from 'react';
import { X, Check, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';

const iconMap = {
  success: Check,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styleMap = {
  success: 'border-status-success/30 text-status-success',
  error: 'border-status-error/30 text-status-error',
  warning: 'border-status-warning/30 text-status-warning',
  info: 'border-accent-blue/30 text-accent-blue',
};

export function Toasts() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-xs">
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
    <div
      className={clsx(
        'flex items-start gap-2 px-3 py-2 rounded-md border',
        'bg-cursor-surface shadow-lg animate-fade-in',
        styleMap[toast.type]
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-text-muted mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-0.5 text-text-muted hover:text-text-secondary rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
