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
import { Button } from '@/shared/ui';
import { GenerateKeyModal } from './components/GenerateKeyModal';
import { ImportKeyModal } from './components/ImportKeyModal';
import type { SSHKey, SSHKeyType } from '@machine/shared';
import styles from './KeysPage.module.css';

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
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>SSH Keys</h1>
          <span className={styles.count}>{keys?.length ?? 0}</span>
        </div>

        <div className={styles.headerRight}>
          <Button variant="ghost" size="sm" iconOnly onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload size={14} />
            Import
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowGenerateModal(true)}>
            <Plus size={14} />
            Generate
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingText}>Loading...</span>
          </div>
        ) : keys && keys.length > 0 ? (
          <div className={styles.list}>
            {keys.map((key) => {
              const isExpanded = expandedKey === key.ssh_key_id;
              const syncableProviders = getSyncableProviders(key);
              const syncedProviders = Object.keys(key.provider_key_ids);

              return (
                <div key={key.ssh_key_id} className={styles.keyCard}>
                  {/* Main row */}
                  <div 
                    className={styles.keyRow}
                    onClick={() => setExpandedKey(isExpanded ? null : key.ssh_key_id)}
                  >
                    <span className={styles.expandIcon}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>

                    <div className={styles.keyIconWrapper}>
                      <Key size={14} className={styles.keyIcon} />
                    </div>

                    <div className={styles.keyInfo}>
                      <div className={styles.keyNameRow}>
                        <span className={styles.keyName}>{key.name}</span>
                        <span className={styles.keyType}>{keyTypeLabels[key.key_type]}</span>
                      </div>
                      <div className={styles.keyMeta}>
                        <span className={clsx(styles.metaItem, 'font-mono')}>
                          <Fingerprint size={12} />
                          {key.fingerprint.slice(0, 16)}...
                        </span>
                        <span className={styles.metaItem}>
                          <Clock size={12} />
                          {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Synced providers */}
                    <div className={styles.providerBadges}>
                      {syncedProviders.map(provider => (
                        <span key={provider} className={styles.providerBadge}>
                          {providerLabels[provider] || provider}
                        </span>
                      ))}
                    </div>

                    <div className={styles.keyActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(key.public_key, 'Public key');
                        }}
                        title="Copy public key"
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPrivateKey(key);
                        }}
                        title="Download private key"
                      >
                        <Download size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${key.name}"?`)) {
                            setDeletingId(key.ssh_key_id);
                            deleteMutation.mutate(key.ssh_key_id);
                          }
                        }}
                        disabled={deletingId === key.ssh_key_id}
                        title="Delete"
                        style={{ color: 'var(--color-error)' }}
                      >
                        {deletingId === key.ssh_key_id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className={styles.expandedSection}>
                      <div className={styles.expandedContent}>
                        {/* Public key */}
                        <div>
                          <label className={styles.expandedLabel}>Public Key</label>
                          <div className={styles.publicKeyBox}>{key.public_key}</div>
                        </div>

                        {/* Provider Sync Section */}
                        <div>
                          <label className={styles.expandedLabel}>Cloud Sync</label>
                          <div className={styles.cloudSyncList}>
                            {/* Synced providers */}
                            {syncedProviders.map(provider => (
                              <div key={provider} className={styles.syncedProvider}>
                                <span className={styles.syncedProviderName}>{provider}</span>
                                <button
                                  onClick={() => unsyncMutation.mutate({ keyId: key.ssh_key_id, providerType: provider })}
                                  className={styles.unsyncButton}
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
                                className={styles.syncButton}
                              >
                                <Cloud size={12} style={{ color: 'var(--color-text-muted)' }} />
                                <span style={{ color: 'var(--color-text-secondary)' }}>{account.label}</span>
                                {syncingKey === key.ssh_key_id && (
                                  <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                                )}
                              </button>
                            ))}

                            {syncedProviders.length === 0 && syncableProviders.length === 0 && (
                              <span className={styles.noProvidersText}>No providers available</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyContent}>
              <p className={styles.emptyText}>No SSH keys</p>
              <div className={styles.emptyActions}>
                <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                  <Upload size={14} />
                  Import
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowGenerateModal(true)}>
                  <Plus size={14} />
                  Generate
                </Button>
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
