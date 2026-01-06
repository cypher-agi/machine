import { useState, useEffect, useRef } from 'react';
import { X, Download, Copy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Deployment } from '@machine/shared';
import { streamDeploymentLogs } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button } from '@/shared/ui';

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
  debug: 'var(--color-text-muted)',
  info: 'var(--color-neon-cyan)',
  warn: 'var(--color-warning)',
  error: 'var(--color-error)',
};

export function DeploymentLogsModal({ deployment, onClose }: DeploymentLogsModalProps) {
  const { addToast } = useAppStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamState, setStreamState] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    const isLive = ['queued', 'planning', 'applying', 'awaiting_approval'].includes(deployment.state);
    setIsStreaming(isLive);

    const seenLogs = new Set<string>();

    const cleanup = streamDeploymentLogs(
      deployment.deployment_id,
      (log) => {
        const logKey = `${log.timestamp}-${log.message}`;
        if (!seenLogs.has(logKey)) {
          seenLogs.add(logKey);
          setLogs((prev) => [...prev, log]);
        }
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
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deployment.deployment_id}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Deployment Logs"
      subtitle={deployment.deployment_id}
      size="xl"
      fullHeight
      headerActions={
        <>
          {isStreaming && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-accent)' }}>
              <Loader2 size={16} className="animate-spin" />
              Live
            </span>
          )}
          {streamState && (
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: streamState === 'succeeded' ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              {streamState}
            </span>
          )}
          <Button variant="ghost" size="sm" iconOnly onClick={copyLogs} title="Copy logs">
            <Copy size={16} />
          </Button>
          <Button variant="ghost" size="sm" iconOnly onClick={downloadLogs} title="Download logs">
            <Download size={16} />
          </Button>
        </>
      }
      noPadding
    >
      {/* Plan Summary */}
      {deployment.plan_summary && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'rgba(19, 19, 22, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Plan:</span>
            {deployment.plan_summary.resources_to_add > 0 && (
              <span style={{ color: 'var(--color-success)' }}>+{deployment.plan_summary.resources_to_add} to add</span>
            )}
            {deployment.plan_summary.resources_to_change > 0 && (
              <span style={{ color: 'var(--color-warning)' }}>~{deployment.plan_summary.resources_to_change} to change</span>
            )}
            {deployment.plan_summary.resources_to_destroy > 0 && (
              <span style={{ color: 'var(--color-error)' }}>-{deployment.plan_summary.resources_to_destroy} to destroy</span>
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-4)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
          backgroundColor: 'var(--color-bg)',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
            {isStreaming ? 'Waiting for logs...' : 'No logs available'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {logs.map((log, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: '2px var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', width: '80px', flexShrink: 0 }}>
                  {format(new Date(log.timestamp), 'HH:mm:ss')}
                </span>
                <span
                  style={{
                    width: '48px',
                    fontSize: 'var(--text-xs)',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                    color: levelColors[log.level] || 'var(--color-text-secondary)',
                  }}
                >
                  {log.level}
                </span>
                <span style={{ color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{logs.length} log entries</span>
        <span>
          Started {deployment.started_at ? format(new Date(deployment.started_at), 'PPpp') : '—'}
          {deployment.finished_at && ` • Finished ${format(new Date(deployment.finished_at), 'PPpp')}`}
        </span>
      </div>
    </Modal>
  );
}
