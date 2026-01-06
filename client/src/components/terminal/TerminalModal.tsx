import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Terminal, Key, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import clsx from 'clsx';
import { SSHTerminal } from './SSHTerminal';
import { getSSHKeys } from '@/lib/api';
import type { Machine, SSHKey } from '@machine/shared';

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

  const selectedKey = sshKeys?.find(k => k.ssh_key_id === selectedKeyId);

  const handleConnect = () => {
    if (selectedKeyId) {
      setIsConnected(true);
    }
  };

  return (
    <div className={clsx(
      'fixed z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in',
      isMaximized ? 'inset-0' : 'inset-0 p-4 md:p-8'
    )}>
      <div className={clsx(
        'bg-black border border-machine-border flex flex-col animate-slide-in-up shadow-2xl overflow-hidden',
        isMaximized 
          ? 'w-full h-full rounded-none' 
          : 'w-full max-w-5xl h-[80vh] rounded-xl'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-machine-card border-b border-machine-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-green/20 border border-neon-cyan/30 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-neon-cyan" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary">Terminal</h2>
              <p className="text-xs text-text-secondary font-mono">{machine.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMaximized(!isMaximized)}
              className="btn btn-ghost btn-icon"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button onClick={onClose} className="btn btn-ghost btn-icon">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {!isConnected ? (
            // Key selection screen
            <div className="h-full flex items-center justify-center p-6">
              <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center mb-4">
                    <Key className="w-8 h-8 text-neon-cyan" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    Select SSH Key
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Choose an SSH key to authenticate with {machine.name}
                  </p>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="text-text-secondary animate-pulse">Loading keys...</span>
                  </div>
                ) : availableKeys.length > 0 ? (
                  <div className="space-y-2">
                    {availableKeys.map((key) => (
                      <button
                        key={key.ssh_key_id}
                        onClick={() => setSelectedKeyId(key.ssh_key_id)}
                        className={clsx(
                          'w-full card text-left transition-all p-3',
                          selectedKeyId === key.ssh_key_id
                            ? 'border-neon-cyan bg-neon-cyan/5'
                            : 'hover:border-machine-border-light'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Key className={clsx(
                            'w-5 h-5',
                            selectedKeyId === key.ssh_key_id ? 'text-neon-cyan' : 'text-text-tertiary'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-text-primary">{key.name}</p>
                            <p className="text-xs text-text-tertiary font-mono truncate">
                              {key.fingerprint}
                            </p>
                          </div>
                          <span className="text-xs text-text-tertiary font-mono">
                            {key.key_type.toUpperCase()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="card bg-status-warning/5 border-status-warning/20 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-text-primary mb-1">No SSH Keys Available</p>
                        <p className="text-sm text-text-secondary">
                          You need to create and sync an SSH key to {machine.provider} before 
                          you can connect. Go to <span className="text-neon-cyan">Keys</span> to 
                          create and sync a key.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button onClick={onClose} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={!selectedKeyId}
                    className="btn btn-primary"
                  >
                    <Terminal className="w-4 h-4" />
                    Connect
                  </button>
                </div>

                <p className="text-xs text-text-tertiary text-center">
                  Connecting as <span className="font-mono text-text-secondary">root@{machine.public_ip}</span>
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
        </div>
      </div>
    </div>
  );
}

