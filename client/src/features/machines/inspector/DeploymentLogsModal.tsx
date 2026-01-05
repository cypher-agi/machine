import { useState, useEffect, useRef } from 'react';
import { X, Download, Copy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Deployment } from '@machine/shared';
import { streamDeploymentLogs } from '@/lib/api';
import { useAppStore } from '@/store/appStore';

interface DeploymentLogsModalProps {
  deployment: Deployment;
  onClose: () => void;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

const levelColors: Record<string, string> = {
  debug: 'text-text-tertiary',
  info: 'text-neon-cyan',
  warn: 'text-status-warning',
  error: 'text-status-error',
};

export function DeploymentLogsModal({ deployment, onClose }: DeploymentLogsModalProps) {
  const { addToast } = useAppStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamState, setStreamState] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Start streaming logs
  useEffect(() => {
    const isLive = ['queued', 'planning', 'applying', 'awaiting_approval'].includes(deployment.state);
    setIsStreaming(isLive);

    const cleanup = streamDeploymentLogs(
      deployment.deployment_id,
      (log) => {
        setLogs((prev) => [...prev, log]);
      },
      (state) => {
        setIsStreaming(false);
        setStreamState(state);
      },
      (error) => {
        console.error('Log stream error:', error);
        setIsStreaming(false);
      }
    );

    return cleanup;
  }, [deployment.deployment_id, deployment.state]);

  const copyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    addToast({ type: 'info', title: 'Copied', message: 'Logs copied to clipboard' });
  };

  const downloadLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deployment.deployment_id}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl max-h-[80vh] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col animate-slide-in-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-machine-border">
          <div>
            <h2 className="font-semibold text-text-primary">Deployment Logs</h2>
            <p className="text-sm text-text-secondary font-mono">
              {deployment.deployment_id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="flex items-center gap-2 text-sm text-status-provisioning">
                <Loader2 className="w-4 h-4 animate-spin" />
                Live
              </span>
            )}
            {streamState && (
              <span className={clsx(
                'text-sm font-medium',
                streamState === 'succeeded' ? 'text-status-running' : 'text-status-error'
              )}>
                {streamState}
              </span>
            )}
            <button
              onClick={copyLogs}
              className="btn btn-ghost btn-icon"
              title="Copy logs"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={downloadLogs}
              className="btn btn-ghost btn-icon"
              title="Download logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Plan Summary */}
        {deployment.plan_summary && (
          <div className="px-4 py-3 border-b border-machine-border bg-machine-elevated/50">
            <div className="flex items-center gap-4 text-sm font-mono">
              <span className="text-text-secondary">Plan:</span>
              {deployment.plan_summary.resources_to_add > 0 && (
                <span className="text-status-running">
                  +{deployment.plan_summary.resources_to_add} to add
                </span>
              )}
              {deployment.plan_summary.resources_to_change > 0 && (
                <span className="text-status-warning">
                  ~{deployment.plan_summary.resources_to_change} to change
                </span>
              )}
              {deployment.plan_summary.resources_to_destroy > 0 && (
                <span className="text-status-error">
                  -{deployment.plan_summary.resources_to_destroy} to destroy
                </span>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        <div 
          ref={logsContainerRef}
          className="flex-1 overflow-auto p-4 font-mono text-sm bg-machine-bg"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-tertiary">
              {isStreaming ? 'Waiting for logs...' : 'No logs available'}
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start gap-3 hover:bg-machine-surface/50 px-2 py-0.5 rounded">
                  <span className="text-text-tertiary text-xs w-20 flex-shrink-0">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </span>
                  <span className={clsx('w-12 text-xs uppercase flex-shrink-0', levelColors[log.level] || 'text-text-secondary')}>
                    {log.level}
                  </span>
                  <span className="text-text-primary break-all">
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-machine-border text-sm text-text-tertiary">
          <div className="flex items-center justify-between">
            <span>{logs.length} log entries</span>
            <span>
              Started {deployment.started_at ? format(new Date(deployment.started_at), 'PPpp') : '—'}
              {deployment.finished_at && ` • Finished ${format(new Date(deployment.finished_at), 'PPpp')}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

