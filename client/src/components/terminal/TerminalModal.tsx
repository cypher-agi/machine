import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Key, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { SSHTerminal } from './SSHTerminal';
import { getSSHKeys } from '@/lib/api';
import { Modal, Button } from '@/shared/ui';
import type { Machine } from '@machina/shared';

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
  const availableKeys = sshKeys?.filter(key => {
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
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
          <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                margin: '0 auto',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(156, 39, 176, 0.1))',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-4)'
              }}>
                <Key size={32} style={{ color: 'var(--color-neon-cyan)' }} />
              </div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                Select SSH Key
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Choose an SSH key to authenticate with {machine.name}
              </p>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8) 0' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Loading keys...</span>
              </div>
            ) : availableKeys.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {availableKeys.map((key) => (
                  <button
                    key={key.ssh_key_id}
                    onClick={() => setSelectedKeyId(key.ssh_key_id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${selectedKeyId === key.ssh_key_id ? 'var(--color-neon-cyan)' : 'var(--color-border)'}`,
                      backgroundColor: selectedKeyId === key.ssh_key_id ? 'rgba(0, 255, 255, 0.05)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <Key size={20} style={{ color: selectedKeyId === key.ssh_key_id ? 'var(--color-neon-cyan)' : 'var(--color-text-tertiary)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>{key.name}</p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {key.fingerprint}
                        </p>
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {key.key_type.toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(250, 204, 21, 0.05)',
                border: '1px solid rgba(250, 204, 21, 0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <AlertTriangle size={20} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>No SSH Keys Available</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      You need to create and sync an SSH key to {machine.provider} before 
                      you can connect. Go to <span style={{ color: 'var(--color-neon-cyan)' }}>Keys</span> to 
                      create and sync a key.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnect}
                disabled={!selectedKeyId}
              >
                <Terminal size={14} />
                Connect
              </Button>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
              Connecting as <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>root@{machine.public_ip}</span>
            </p>
          </div>
        </div>
      ) : (
        // Terminal
        <SSHTerminal
          machineId={machine.machine_id}
          sshKeyId={selectedKeyId!}
          machineName={machine.name}
          machineIp={machine.public_ip || 'unknown'}
          onDisconnect={() => setIsConnected(false)}
        />
      )}
    </Modal>
  );
}
