import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Check, X, AlertCircle, Trash2, Shield, Clock, KeyRound } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { getProviderAccounts, verifyProviderAccount, updateProviderAccount, deleteProviderAccount } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button, Input, Modal } from '@/shared/ui';
import { AddProviderModal } from './components/AddProviderModal';
import type { CredentialStatus, ProviderAccount } from '@machine/shared';
import styles from './ProvidersPage.module.css';

const providerLabels: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
  baremetal: 'BM',
};

const credentialStatusConfig: Record<CredentialStatus, { icon: typeof Check; className: string; label: string }> = {
  valid: { icon: Check, className: styles.statusValid, label: 'Valid' },
  invalid: { icon: X, className: styles.statusInvalid, label: 'Invalid' },
  expired: { icon: AlertCircle, className: styles.statusExpired, label: 'Expired' },
  unchecked: { icon: AlertCircle, className: styles.statusUnchecked, label: 'Unchecked' },
};

function ProvidersPage() {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingAccount, setUpdatingAccount] = useState<ProviderAccount | null>(null);
  const [newToken, setNewToken] = useState('');

  const { data: accounts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['provider-accounts'],
    queryFn: getProviderAccounts,
  });

  const verifyMutation = useMutation({
    mutationFn: verifyProviderAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Verified', message: 'Credentials are valid' });
      setVerifyingId(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Verification failed', message: error.message });
      setVerifyingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProviderAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Account deleted' });
      setDeletingId(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
      setDeletingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, token }: { id: string; token: string }) =>
      updateProviderAccount(id, { credentials: { api_token: token } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Token updated' });
      setUpdatingAccount(null);
      setNewToken('');
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Update failed', message: error.message });
    },
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Providers</h1>
          <span className={styles.count}>{accounts?.length ?? 0}</span>
        </div>

        <div className={styles.headerRight}>
          <Button variant="ghost" size="sm" iconOnly onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            Add
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}>
            <span className={styles.loadingText}>Loading...</span>
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className={styles.list}>
            {accounts.map((account) => {
              const status = credentialStatusConfig[account.credential_status];
              const StatusIcon = status.icon;

              return (
                <div key={account.provider_account_id} className={styles.card}>
                  <div className={styles.providerIcon}>
                    <span className={styles.providerIconText}>
                      {providerLabels[account.provider_type] || '??'}
                    </span>
                  </div>

                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{account.label}</span>
                      <span className={clsx(styles.status, status.className)}>
                        <StatusIcon size={12} />
                        {status.label}
                      </span>
                    </div>
                    <div className={styles.meta}>
                      <span className={styles.metaItem} style={{ textTransform: 'capitalize' }}>
                        {account.provider_type}
                      </span>
                      <span className={styles.metaItem}>
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setVerifyingId(account.provider_account_id);
                        verifyMutation.mutate(account.provider_account_id);
                      }}
                      disabled={verifyingId === account.provider_account_id}
                    >
                      {verifyingId === account.provider_account_id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Shield size={14} />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setUpdatingAccount(account)}>
                      <KeyRound size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete "${account.label}"?`)) {
                          setDeletingId(account.provider_account_id);
                          deleteMutation.mutate(account.provider_account_id);
                        }
                      }}
                      disabled={deletingId === account.provider_account_id}
                      style={{ color: 'var(--color-error)' }}
                    >
                      {deletingId === account.provider_account_id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyContent}>
              <p className={styles.emptyText}>No provider accounts</p>
              <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                <Plus size={14} />
                Add Provider
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Provider Modal */}
      {showAddModal && <AddProviderModal onClose={() => setShowAddModal(false)} />}

      {/* Update Token Modal */}
      {updatingAccount && (
        <Modal
          isOpen={true}
          onClose={() => {
            setUpdatingAccount(null);
            setNewToken('');
          }}
          title="Update Token"
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setUpdatingAccount(null);
                  setNewToken('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => updateMutation.mutate({ id: updatingAccount.provider_account_id, token: newToken })}
                disabled={!newToken || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            Update API token for <span style={{ color: 'var(--color-text-secondary)' }}>{updatingAccount.label}</span>
          </p>
          <Input
            type="password"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder="New API token..."
            mono
            size="sm"
            autoFocus
          />
        </Modal>
      )}
    </div>
  );
}

export default ProvidersPage;
