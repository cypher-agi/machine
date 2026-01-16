import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Key, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { SSHTerminal } from '../SSHTerminal';
import { getSSHKeys } from '@/lib/api';
import { Modal, Button } from '@/shared';
import type { Machine } from '@machina/shared';
import clsx from 'clsx';
import styles from './TerminalModal.module.css';

interface TerminalModalProps {
  machine: Machine;
  onClose: () => void;
}

export function TerminalModal({ machine, onClose }: TerminalModalProps) {
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const { data: sshKeys, isLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: getSSHKeys,
  });

  // Filter keys that have private keys stored (we can only connect with those)
  // and are synced to the provider (for proper identification)
  const availableKeys =
    sshKeys?.filter((key) => {
      // Key must be synced to the machine's provider
      return key.provider_key_ids[machine.provider];
    }) || [];

  const handleConnect = () => {
    if (selectedKeyId) {
      setIsConnected(true);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Terminal"
      subtitle={machine.name}
      size={isMaximized ? 'full' : 'xl'}
      fullHeight
      noPadding
      animateHeight={!isConnected}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => setIsMaximized(!isMaximized)}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </Button>
      }
    >
      {!isConnected ? (
        // Key selection screen
        <div className={styles.keySelectionContainer}>
          <div className={styles.keySelectionContent}>
            <div className={styles.header}>
              <div className={styles.iconContainer}>
                <Key size={32} className={styles.icon} />
              </div>
              <h3 className={styles.title}>Select SSH Key</h3>
              <p className={styles.subtitle}>
                Choose an SSH key to authenticate with {machine.name}
              </p>
            </div>

            {isLoading ? (
              <div className={styles.loadingContainer}>
                <span className={styles.loadingText}>Loading keys...</span>
              </div>
            ) : availableKeys.length > 0 ? (
              <div className={styles.keyList}>
                {availableKeys.map((key) => (
                  <button
                    key={key.ssh_key_id}
                    onClick={() => setSelectedKeyId(key.ssh_key_id)}
                    className={clsx(
                      styles.keyButton,
                      selectedKeyId === key.ssh_key_id && styles.keyButtonSelected
                    )}
                  >
                    <div className={styles.keyButtonContent}>
                      <Key
                        size={20}
                        className={clsx(
                          styles.keyIcon,
                          selectedKeyId === key.ssh_key_id && styles.keyIconSelected
                        )}
                      />
                      <div className={styles.keyInfo}>
                        <p className={styles.keyName}>{key.name}</p>
                        <p className={styles.keyFingerprint}>{key.fingerprint}</p>
                      </div>
                      <span className={styles.keyType}>{key.key_type.toUpperCase()}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.warningContainer}>
                <div className={styles.warningContent}>
                  <AlertTriangle size={20} className={styles.warningIcon} />
                  <div>
                    <p className={styles.warningTitle}>No SSH Keys Available</p>
                    <p className={styles.warningText}>
                      You need to create and sync an SSH key to {machine.provider} before you can
                      connect. Go to <span className={styles.warningHighlight}>Keys</span> to create
                      and sync a key.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.footer}>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConnect} disabled={!selectedKeyId}>
                <Terminal size={14} />
                Connect
              </Button>
            </div>

            <p className={styles.connectionInfo}>
              Connecting as <span className={styles.connectionHost}>root@{machine.public_ip}</span>
            </p>
          </div>
        </div>
      ) : (
        // Terminal
        <SSHTerminal
          machineId={machine.machine_id}
          sshKeyId={selectedKeyId ?? ''}
          machineName={machine.name}
          machineIp={machine.public_ip || 'unknown'}
          onDisconnect={() => setIsConnected(false)}
        />
      )}
    </Modal>
  );
}
