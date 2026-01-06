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
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
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

const providerLabels: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
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
      addToast({ type: 'success', title: 'Key deleted' });
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
      addToast({ type: 'success', title: 'Key synced' });
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
      addToast({ type: 'success', title: 'Copied', message: `${label} copied` });
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
      addToast({ type: 'success', title: 'Downloaded' });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Download failed', message: error.message });
    }
  };

  const getSyncableProviders = (key: SSHKey) => {
    if (!providerAccounts) return [];
    const syncedTypes = Object.keys(key.provider_key_ids);
    return providerAccounts.filter(a => 
      !syncedTypes.includes(a.provider_type) && 
      a.credential_status === 'valid'
    );
  };

  return (
    <div className="h-full flex flex-col bg-cursor-bg">
      {/* Header */}
      <header className="flex-shrink-0 h-12 border-b border-cursor-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-text-primary">SSH Keys</h1>
          <span className="text-xs text-text-muted font-mono">
            {keys?.length ?? 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn btn-ghost btn-icon"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary btn-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-text-muted">Loading...</span>
          </div>
        ) : keys && keys.length > 0 ? (
          <div className="space-y-1">
            {keys.map((key) => {
              const isExpanded = expandedKey === key.ssh_key_id;
              const syncableProviders = getSyncableProviders(key);
              const syncedProviders = Object.keys(key.provider_key_ids);

              return (
                <div key={key.ssh_key_id} className="rounded-md border border-cursor-border overflow-hidden">
                  {/* Main row */}
                  <div 
                    className="group flex items-center gap-3 px-3 py-2 bg-cursor-surface hover:bg-cursor-elevated cursor-pointer transition-colors"
                    onClick={() => setExpandedKey(isExpanded ? null : key.ssh_key_id)}
                  >
                    <button className="p-0.5 text-text-muted">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    <div className="w-8 h-8 rounded bg-cursor-elevated border border-cursor-border flex items-center justify-center">
                      <Key className="w-3.5 h-3.5 text-text-muted" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-primary font-medium truncate">
                          {key.name}
                        </span>
                        <span className="text-[10px] font-mono bg-cursor-border px-1.5 py-0.5 rounded text-text-muted">
                          {keyTypeLabels[key.key_type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1 font-mono">
                          <Fingerprint className="w-3 h-3" />
                          {key.fingerprint.slice(0, 16)}...
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Synced providers */}
                    <div className="flex items-center gap-1">
                      {syncedProviders.map(provider => (
                        <span 
                          key={provider}
                          className="text-[10px] font-mono bg-status-success/10 text-status-success px-1.5 py-0.5 rounded"
                        >
                          {providerLabels[provider] || provider}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(key.public_key, 'Public key');
                        }}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Copy public key"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPrivateKey(key);
                        }}
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Download private key"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${key.name}"?`)) {
                            setDeletingId(key.ssh_key_id);
                            deleteMutation.mutate(key.ssh_key_id);
                          }
                        }}
                        disabled={deletingId === key.ssh_key_id}
                        className="btn btn-ghost btn-sm btn-icon text-status-error"
                        title="Delete"
                      >
                        {deletingId === key.ssh_key_id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t border-cursor-border bg-cursor-bg space-y-3">
                      {/* Public key */}
                      <div>
                        <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">
                          Public Key
                        </label>
                        <div className="bg-cursor-surface rounded p-2 font-mono text-[11px] text-text-muted break-all leading-relaxed">
                          {key.public_key}
                        </div>
                      </div>

                      {/* Provider Sync Section */}
                      <div>
                        <label className="text-[10px] text-text-muted uppercase tracking-wider mb-2 block">
                          Cloud Sync
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {/* Synced providers */}
                          {syncedProviders.map(provider => (
                            <div 
                              key={provider}
                              className="flex items-center gap-2 px-2 py-1.5 bg-status-success/5 border border-status-success/20 rounded text-xs"
                            >
                              <span className="text-text-primary capitalize">{provider}</span>
                              <button
                                onClick={() => unsyncMutation.mutate({ keyId: key.ssh_key_id, providerType: provider })}
                                className="text-text-muted hover:text-status-error"
                              >
                                ×
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
                              className="flex items-center gap-1.5 px-2 py-1.5 bg-cursor-surface border border-cursor-border rounded text-xs hover:border-accent-blue transition-colors"
                            >
                              <Cloud className="w-3 h-3 text-text-muted" />
                              <span className="text-text-secondary">{account.label}</span>
                              {syncingKey === key.ssh_key_id && (
                                <RefreshCw className="w-3 h-3 animate-spin text-accent-blue" />
                              )}
                            </button>
                          ))}

                          {syncedProviders.length === 0 && syncableProviders.length === 0 && (
                            <span className="text-xs text-text-muted">No providers available</span>
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
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-3">No SSH keys</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setShowImportModal(true)} className="btn btn-secondary btn-sm">
                  <Upload className="w-3.5 h-3.5" />
                  Import
                </button>
                <button onClick={() => setShowGenerateModal(true)} className="btn btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}
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
