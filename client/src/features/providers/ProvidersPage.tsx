import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  RefreshCw, 
  Check, 
  X, 
  AlertCircle,
  Trash2,
  Shield,
  Clock,
  KeyRound
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { 
  getProviderAccounts, 
  verifyProviderAccount,
  updateProviderAccount,
  deleteProviderAccount 
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { AddProviderModal } from './AddProviderModal';
import type { CredentialStatus, ProviderAccount } from '@machine/shared';

const providerLabels: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
  baremetal: 'BM',
};

const credentialStatusConfig: Record<CredentialStatus, { icon: typeof Check; class: string; label: string }> = {
  valid: { icon: Check, class: 'text-status-success', label: 'Valid' },
  invalid: { icon: X, class: 'text-status-error', label: 'Invalid' },
  expired: { icon: AlertCircle, class: 'text-status-warning', label: 'Expired' },
  unchecked: { icon: AlertCircle, class: 'text-text-muted', label: 'Unchecked' },
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
    <div className="h-full flex flex-col bg-cursor-bg">
      {/* Header */}
      <header className="flex-shrink-0 h-12 border-b border-cursor-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-text-primary">Providers</h1>
          <span className="text-xs text-text-muted font-mono">
            {accounts?.length ?? 0}
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
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-text-muted">Loading...</span>
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="space-y-1">
            {accounts.map((account) => {
              const status = credentialStatusConfig[account.credential_status];
              const StatusIcon = status.icon;

              return (
                <div 
                  key={account.provider_account_id} 
                  className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-cursor-surface transition-colors"
                >
                  <div className="w-8 h-8 rounded bg-cursor-elevated border border-cursor-border flex items-center justify-center">
                    <span className="text-[10px] font-mono font-medium text-text-muted">
                      {providerLabels[account.provider_type] || '??'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary font-medium truncate">
                        {account.label}
                      </span>
                      <span className={clsx('flex items-center gap-1 text-xs', status.class)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="capitalize">{account.provider_type}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setVerifyingId(account.provider_account_id);
                        verifyMutation.mutate(account.provider_account_id);
                      }}
                      disabled={verifyingId === account.provider_account_id}
                      className="btn btn-ghost btn-sm"
                    >
                      {verifyingId === account.provider_account_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setUpdatingAccount(account)}
                      className="btn btn-ghost btn-sm"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${account.label}"?`)) {
                          setDeletingId(account.provider_account_id);
                          deleteMutation.mutate(account.provider_account_id);
                        }
                      }}
                      disabled={deletingId === account.provider_account_id}
                      className="btn btn-ghost btn-sm text-status-error"
                    >
                      {deletingId === account.provider_account_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-3">No provider accounts</p>
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Add Provider
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Provider Modal */}
      {showAddModal && (
        <AddProviderModal onClose={() => setShowAddModal(false)} />
      )}

      {/* Update Token Modal */}
      {updatingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cursor-bg/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-cursor-surface border border-cursor-border rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cursor-border">
              <h2 className="text-sm font-medium text-text-primary">Update Token</h2>
              <button 
                onClick={() => { setUpdatingAccount(null); setNewToken(''); }} 
                className="p-1 text-text-muted hover:text-text-secondary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-text-muted">
                Update API token for <span className="text-text-secondary">{updatingAccount.label}</span>
              </p>
              <input
                type="password"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="New API token..."
                className="input font-mono text-xs"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-cursor-border">
              <button 
                onClick={() => { setUpdatingAccount(null); setNewToken(''); }} 
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => updateMutation.mutate({ id: updatingAccount.provider_account_id, token: newToken })}
                disabled={!newToken || updateMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProvidersPage;
