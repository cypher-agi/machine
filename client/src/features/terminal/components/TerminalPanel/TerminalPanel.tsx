import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Key } from 'lucide-react';
import { Drawer } from '@cypher-agi/zui';
import { SSHTerminal } from '../SSHTerminal';
import { getSSHKeys, getMachine } from '@/lib/api';
import styles from './TerminalPanel.module.css';

interface TerminalPanelProps {
  machineId: string;
  onClose: () => void;
}

export function TerminalPanel({ machineId, onClose }: TerminalPanelProps) {
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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

  return (
    <Drawer
      side="bottom"
      isOpen={true}
      onClose={onClose}
      minSize={200}
      maxSize={800}
      defaultSize={300}
      storageKey="terminal-panel-height"
      {...(styles.panel ? { className: styles.panel } : {})}
    >
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
      </div>

      {/* Content */}
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
    </Drawer>
  );
}
