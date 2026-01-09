import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Bot,
  ChevronDown,
  ChevronUp,
  Brain,
  Wrench,
  Check,
  MessageSquare,
  Inbox,
  ArrowRightLeft,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import type { RecordType } from '@machina/shared';
import { mockAgents, mockRecords, AGENT_STATUS_CONFIG } from '@/apps/agents/mock';
// Reuse TerminalPanel styles for consistent UI
import styles from '../TerminalPanel/TerminalPanel.module.css';

interface AgentTerminalPanelProps {
  agentId: string;
  onClose: () => void;
}

const RECORD_TYPE_ICONS: Record<
  RecordType,
  React.ComponentType<{ size?: number; className?: string }>
> = {
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
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const recordsEndRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const minHeight = 200;
  const headerHeight = 48;

  // Get agent data
  const agent = mockAgents.find((a) => a.agent_id === agentId);

  // Get records for this agent
  const agentRecords = mockRecords.filter((r) => r.agent_id === agentId);

  // Calculate dynamic heights based on container
  const getDefaultHeight = useCallback(
    () => Math.max(minHeight, Math.floor(containerHeight / 3)),
    [containerHeight]
  );
  const getMaxHeight = useCallback(() => Math.floor(containerHeight * 0.9), [containerHeight]);

  // Measure container height on mount and resize
  useEffect(() => {
    const updateContainerHeight = () => {
      const pageElement = panelRef.current?.parentElement;
      if (pageElement) {
        setContainerHeight(pageElement.clientHeight);
      } else {
        setContainerHeight(window.innerHeight - headerHeight);
      }
    };

    updateContainerHeight();
    window.addEventListener('resize', updateContainerHeight);
    return () => window.removeEventListener('resize', updateContainerHeight);
  }, []);

  // Set default height once container is measured
  useEffect(() => {
    if (containerHeight > 0 && panelHeight === null) {
      setPanelHeight(getDefaultHeight());
    }
  }, [containerHeight, panelHeight, getDefaultHeight]);

  // Auto-scroll to bottom when new records arrive
  useEffect(() => {
    recordsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentRecords.length]);

  // Handle drag to resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startY.current = e.clientY;
      startHeight.current = panelHeight || getDefaultHeight();
    },
    [panelHeight, getDefaultHeight]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = startY.current - e.clientY;
      const maxHeight = getMaxHeight();
      const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight.current + deltaY));
      setPanelHeight(newHeight);
    },
    [isDragging, getMaxHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!agent) {
    return null;
  }

  const currentHeight = panelHeight || getDefaultHeight();
  const isOverlay = currentHeight > containerHeight * 0.5;
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
    <div
      ref={panelRef}
      className={clsx(
        styles.panel,
        isDragging && styles.panelResizing,
        isOverlay && styles.panelOverlay
      )}
      style={{ height: isMinimized ? 40 : currentHeight }}
    >
      {/* Drag handle */}
      <div className={styles.dragHandle} onMouseDown={handleMouseDown}>
        <div className={styles.dragHandleLine} />
      </div>

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

        <div className={styles.headerRight}>
          <button
            className={styles.headerButton}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button className={styles.headerButton} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
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
      )}
    </div>
  );
}
