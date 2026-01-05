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
  success: 'bg-status-running/10 border-status-running/30 text-status-running',
  error: 'bg-status-error/10 border-status-error/30 text-status-error',
  warning: 'bg-status-warning/10 border-status-warning/30 text-status-warning',
  info: 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan',
};

export function Toasts() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
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
        'flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in-up',
        'bg-machine-surface/95',
        styleMap[toast.type]
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-text-secondary mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-1 text-text-tertiary hover:text-text-secondary rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}



