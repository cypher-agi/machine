import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  RefreshCw, 
  Key,
  Copy,
  Download,
  Trash2,
  Cloud,
  Clock,
  Upload,
  Fingerprint,
  Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { 
  getSSHKeys, 
  deleteSSHKey,
  getSSHKeyPrivate,
  getProviderAccounts,
  syncSSHKeyToProvider,
  unsyncSSHKeyFromProvider
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { GenerateKeyModal } from './GenerateKeyModal';
import { ImportKeyModal } from './ImportKeyModal';
import type { SSHKey, SSHKeyType } from '@machine/shared';

const keyTypeLabels: Record<SSHKeyType, string> = {
  ed25519: 'ED25519',
  rsa: 'RSA',
  ecdsa: 'ECDSA'
};

const providerIcons: Record<string, string> = {
  digitalocean: '🌊',
  aws: '☁️',
  gcp: '🔷',
  hetzner: '🏢',
};

function KeysPage() {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data: keys, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: getSSHKeys,
  });

  const { data: providerAccounts } = useQuery({
    queryKey: ['provider-accounts'],
    queryFn: getProviderAccounts,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSSHKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      addToast({ type: 'success', title: 'SSH key deleted' });
      setDeletingId(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
      setDeletingId(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: ({ keyId, providerAccountId }: { keyId: string; providerAccountId: string }) => 
      syncSSHKeyToProvider(keyId, providerAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      addToast({ type: 'success', title: 'Key synced to provider' });
      setSyncingKey(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Sync failed', message: error.message });
      setSyncingKey(null);
    },
  });

  const unsyncMutation = useMutation({
    mutationFn: ({ keyId, providerType }: { keyId: string; providerType: string }) => 
      unsyncSSHKeyFromProvider(keyId, providerType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      addToast({ type: 'success', title: 'Key removed from provider' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Remove failed', message: error.message });
    },
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ type: 'success', title: 'Copied', message: `${label} copied to clipboard` });
    } catch {
      addToast({ type: 'error', title: 'Copy failed' });
    }
  };

  const downloadPrivateKey = async (key: SSHKey) => {
    try {
      const { private_key } = await getSSHKeyPrivate(key.ssh_key_id);
      const blob = new Blob([private_key], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${key.name.replace(/\s+/g, '_')}_id_${key.key_type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Downloaded', message: 'Private key downloaded' });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Download failed', message: error.message });
    }
  };

  const getSyncableProviders = (key: SSHKey) => {
    if (!providerAccounts) return [];
    // Get providers that don't already have this key
    const syncedTypes = Object.keys(key.provider_key_ids);
    return providerAccounts.filter(a => 
      !syncedTypes.includes(a.provider_type) && 
      a.credential_status === 'valid'
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-machine-border bg-black px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-text-primary">SSH Keys</h1>
          <span className="text-sm text-text-tertiary font-mono">
            {keys?.length ?? 0} keys
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn btn-ghost btn-icon"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary"
          >
            <Upload className="w-4 h-4" />
            Import Key
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Generate Key
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-text-secondary animate-pulse">Loading keys...</span>
          </div>
        ) : keys && keys.length > 0 ? (
          <div className="space-y-3">
            {keys.map((key) => {
              const isExpanded = expandedKey === key.ssh_key_id;
              const syncableProviders = getSyncableProviders(key);
              const syncedProviders = Object.keys(key.provider_key_ids);

              return (
                <div key={key.ssh_key_id} className="card">
                  {/* Main row */}
                  <div 
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedKey(isExpanded ? null : key.ssh_key_id)}
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center">
                      <Key className="w-5 h-5 text-neon-cyan" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-text-primary">{key.name}</h3>
                        <span className="text-xs font-mono bg-machine-elevated px-2 py-0.5 rounded text-text-secondary">
                          {keyTypeLabels[key.key_type]} {key.key_bits}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-secondary">
                        <span className="flex items-center gap-1 font-mono text-xs">
                          <Fingerprint className="w-3.5 h-3.5" />
                          {key.fingerprint.slice(0, 24)}...
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Created {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Synced providers badges */}
                    <div className="flex items-center gap-2">
                      {syncedProviders.map(provider => (
                        <span 
                          key={provider}
                          className="flex items-center gap-1 text-xs bg-status-running/10 text-status-running px-2 py-1 rounded-full"
                        >
                          <span>{providerIcons[provider]}</span>
                          {provider}
                        </span>
                      ))}
                      {syncedProviders.length === 0 && (
                        <span className="text-xs text-text-tertiary">Not synced</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(key.public_key, 'Public key');
                        }}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Copy public key"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPrivateKey(key);
                        }}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Download private key"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete SSH key "${key.name}"? This will NOT remove it from cloud providers.`)) {
                            setDeletingId(key.ssh_key_id);
                            deleteMutation.mutate(key.ssh_key_id);
                          }
                        }}
                        disabled={deletingId === key.ssh_key_id}
                        className="btn btn-danger btn-sm btn-icon"
                        title="Delete key"
                      >
                        {deletingId === key.ssh_key_id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-machine-border space-y-4">
                      {/* Public key */}
                      <div>
                        <label className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">
                          Public Key
                        </label>
                        <div className="bg-machine-elevated rounded-lg p-3 font-mono text-xs text-text-secondary break-all">
                          {key.public_key}
                        </div>
                      </div>

                      {/* Provider Sync Section */}
                      <div>
                        <label className="text-xs text-text-tertiary uppercase tracking-wider mb-2 block">
                          Cloud Provider Sync
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Synced providers */}
                          {syncedProviders.map(provider => (
                            <div 
                              key={provider}
                              className="flex items-center justify-between p-3 bg-status-running/5 border border-status-running/20 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{providerIcons[provider]}</span>
                                <div>
                                  <p className="text-sm font-medium text-text-primary capitalize">{provider}</p>
                                  <p className="text-xs text-text-tertiary font-mono">
                                    ID: {key.provider_key_ids[provider]}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => unsyncMutation.mutate({ keyId: key.ssh_key_id, providerType: provider })}
                                className="btn btn-ghost btn-sm text-status-error"
                              >
                                Remove
                              </button>
                            </div>
                          ))}

                          {/* Syncable providers */}
                          {syncableProviders.map(account => (
                            <button
                              key={account.provider_account_id}
                              onClick={() => {
                                setSyncingKey(key.ssh_key_id);
                                syncMutation.mutate({ 
                                  keyId: key.ssh_key_id, 
                                  providerAccountId: account.provider_account_id 
                                });
                              }}
                              disabled={syncingKey === key.ssh_key_id}
                              className="flex items-center justify-between p-3 bg-machine-elevated border border-machine-border rounded-lg hover:border-neon-cyan/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{providerIcons[account.provider_type]}</span>
                                <div className="text-left">
                                  <p className="text-sm font-medium text-text-primary">{account.label}</p>
                                  <p className="text-xs text-text-tertiary capitalize">{account.provider_type}</p>
                                </div>
                              </div>
                              {syncingKey === key.ssh_key_id ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-neon-cyan" />
                              ) : (
                                <Cloud className="w-4 h-4 text-text-tertiary" />
                              )}
                            </button>
                          ))}

                          {syncedProviders.length === 0 && syncableProviders.length === 0 && (
                            <p className="text-sm text-text-tertiary col-span-2">
                              No provider accounts available. Add a provider account first.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center mb-4">
              <Key className="w-8 h-8 text-neon-cyan" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-1">No SSH keys</h3>
            <p className="text-text-secondary mb-4 text-center max-w-md">
              Generate or import SSH keys to securely access your machines.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowImportModal(true)} className="btn btn-secondary">
                <Upload className="w-4 h-4" />
                Import Key
              </button>
              <button onClick={() => setShowGenerateModal(true)} className="btn btn-primary">
                <Plus className="w-4 h-4" />
                Generate Key
              </button>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="mt-6 p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-neon-cyan flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-text-primary mb-1">About SSH Key Storage</h4>
              <p className="text-sm text-text-secondary">
                Private keys are encrypted with AES-256-GCM before storage. When you sync a key to a provider, 
                only the public key is uploaded. You can use synced keys when deploying new machines.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showGenerateModal && (
        <GenerateKeyModal onClose={() => setShowGenerateModal(false)} />
      )}
      {showImportModal && (
        <ImportKeyModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  );
}

export default KeysPage;

