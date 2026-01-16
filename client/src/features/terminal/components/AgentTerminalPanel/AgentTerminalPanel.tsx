import { useRef, useEffect } from 'react';
import {
  Bot,
  Brain,
  Wrench,
  Check,
  MessageSquare,
  Inbox,
  ArrowRightLeft,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Drawer } from '@cypher-agi/zui';
import type { RecordType } from '@machina/shared';
import { mockAgents, mockRecords, AGENT_STATUS_CONFIG } from '@/apps/agents/mock';
// Reuse TerminalPanel styles for consistent UI
import styles from '../TerminalPanel/TerminalPanel.module.css';

interface AgentTerminalPanelProps {
  agentId: string;
  onClose: () => void;
}

const RECORD_TYPE_ICONS: Record<RecordType, LucideIcon> = {
  reasoning: Brain,
  tool_call: Wrench,
  tool_result: Check,
  message_sent: MessageSquare,
  message_received: Inbox,
  transaction: ArrowRightLeft,
  error: AlertCircle,
  state_change: RefreshCw,
};

const RECORD_TYPE_COLORS: Record<RecordType, string> = {
  reasoning: 'var(--color-primary)',
  tool_call: 'var(--color-warning)',
  tool_result: 'var(--color-success)',
  message_sent: 'var(--color-text-secondary)',
  message_received: 'var(--color-info)',
  transaction: 'var(--color-primary)',
  error: 'var(--color-error)',
  state_change: 'var(--color-text-muted)',
};

export function AgentTerminalPanel({ agentId, onClose }: AgentTerminalPanelProps) {
  const recordsEndRef = useRef<HTMLDivElement>(null);

  // Get agent data
  const agent = mockAgents.find((a) => a.agent_id === agentId);

  // Get records for this agent
  const agentRecords = mockRecords.filter((r) => r.agent_id === agentId);

  // Auto-scroll to bottom when new records arrive
  useEffect(() => {
    recordsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentRecords.length]);

  if (!agent) {
    return null;
  }

  const status = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.error;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return (
      date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) +
      '.' +
      date.getMilliseconds().toString().padStart(3, '0')
    );
  };

  return (
    <Drawer
      side="bottom"
      isOpen={true}
      onClose={onClose}
      minSize={200}
      maxSize={800}
      defaultSize={300}
      storageKey="agent-terminal-panel-height"
      {...(styles.panel ? { className: styles.panel } : {})}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.terminalIcon}>
            <Bot size={14} />
          </div>
          <span className={styles.title}>Agent</span>
          <span className={styles.separator}>—</span>
          <span className={styles.machineName}>{agent.name}</span>
          <span className={styles.separator}>•</span>
          <span className={styles.machineIp}>@{agent.zid}</span>
          {agent.status === 'running' && (
            <span className={styles.connectedBadge}>{status.label}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {agentRecords.length === 0 ? (
          <div className={styles.notReady}>
            <Bot size={24} className={styles.notReadyIcon} />
            <p className={styles.notReadyText}>
              {agent.status === 'stopped'
                ? 'Agent is stopped'
                : agent.status === 'error'
                  ? 'Agent encountered an error'
                  : 'No activity records yet'}
            </p>
          </div>
        ) : (
          <div className={styles.terminal}>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 'var(--space-3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                lineHeight: '1.6',
              }}
            >
              {agentRecords.map((record) => {
                const Icon = RECORD_TYPE_ICONS[record.type];
                const color = RECORD_TYPE_COLORS[record.type];

                return (
                  <div
                    key={record.record_id}
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-1)',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                      [{formatTimestamp(record.timestamp)}]
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color,
                        flexShrink: 0,
                        minWidth: '100px',
                      }}
                    >
                      <Icon size={12} />
                      {record.type.toUpperCase().replace('_', ' ')}
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{record.content}</span>
                  </div>
                );
              })}
              <div ref={recordsEndRef} />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
