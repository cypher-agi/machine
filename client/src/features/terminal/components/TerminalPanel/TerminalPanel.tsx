import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Terminal, Key, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { SSHTerminal } from '../SSHTerminal';
import { getSSHKeys, getMachine } from '@/lib/api';
import styles from './TerminalPanel.module.css';

interface TerminalPanelProps {
  machineId: string;
  onClose: () => void;
}

export function TerminalPanel({ machineId, onClose }: TerminalPanelProps) {
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const minHeight = 200;
  const headerHeight = 48; // Global header height

  // Calculate dynamic heights based on container
  const getDefaultHeight = useCallback(
    () => Math.max(minHeight, Math.floor(containerHeight / 3)),
    [containerHeight]
  );
  const getMaxHeight = useCallback(() => Math.floor(containerHeight * 0.9), [containerHeight]);

  // Measure container height on mount and resize
  useEffect(() => {
    const updateContainerHeight = () => {
      // Get the height of the page container (viewport minus header)
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

  // Fetch machine data
  const { data: machine } = useQuery({
    queryKey: ['machine', machineId],
    queryFn: () => getMachine(machineId),
  });

  // Fetch SSH keys
  const { data: sshKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: getSSHKeys,
  });

  // Filter keys that are synced to the machine's provider
  const availableKeys =
    sshKeys?.filter((key) => {
      return machine && key.provider_key_ids[machine.provider];
    }) || [];

  // Reset connection state when machine changes
  useEffect(() => {
    setIsConnected(false);
    setSelectedKeyId(null);
  }, [machineId]);

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

  const handleConnect = (keyId: string) => {
    setSelectedKeyId(keyId);
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  if (!machine) {
    return null;
  }

  const canConnect = machine.actual_status === 'running' && machine.public_ip;
  const currentHeight = panelHeight || getDefaultHeight();
  const isOverlay = currentHeight > containerHeight * 0.5;

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
            <Terminal size={14} />
          </div>
          <span className={styles.title}>Terminal</span>
          <span className={styles.separator}>—</span>
          <span className={styles.machineName}>{machine.name}</span>
          {machine.public_ip && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.machineIp}>{machine.public_ip}</span>
            </>
          )}
          {isConnected && <span className={styles.connectedBadge}>Connected</span>}
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
          {!canConnect ? (
            // Machine not ready
            <div className={styles.notReady}>
              <Terminal size={24} className={styles.notReadyIcon} />
              <p className={styles.notReadyText}>
                {machine.actual_status === 'provisioning'
                  ? 'Machine is still provisioning...'
                  : machine.actual_status === 'stopped'
                    ? 'Machine is stopped'
                    : !machine.public_ip
                      ? 'Machine has no public IP'
                      : 'Machine is not running'}
              </p>
            </div>
          ) : !isConnected ? (
            // Key selection
            <div className={styles.keySelection}>
              {keysLoading ? (
                <div className={styles.loading}>
                  <span>Loading SSH keys...</span>
                </div>
              ) : availableKeys.length > 0 ? (
                <div className={styles.keyList}>
                  <p className={styles.keyPrompt}>Select SSH key to connect:</p>
                  <div className={styles.keys}>
                    {availableKeys.map((key) => (
                      <button
                        key={key.ssh_key_id}
                        className={styles.keyButton}
                        onClick={() => handleConnect(key.ssh_key_id)}
                      >
                        <Key size={14} className={styles.keyIcon} />
                        <span className={styles.keyName}>{key.name}</span>
                        <span className={styles.keyType}>{key.key_type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.noKeys}>
                  <Key size={20} className={styles.noKeysIcon} />
                  <p className={styles.noKeysText}>No SSH keys synced to {machine.provider}</p>
                  <p className={styles.noKeysHint}>Go to Keys to create and sync an SSH key</p>
                </div>
              )}
            </div>
          ) : (
            // Terminal
            <div className={styles.terminal}>
              <SSHTerminal
                machineId={machine.machine_id}
                sshKeyId={selectedKeyId ?? ''}
                machineName={machine.name}
                machineIp={machine.public_ip || 'unknown'}
                onDisconnect={handleDisconnect}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
