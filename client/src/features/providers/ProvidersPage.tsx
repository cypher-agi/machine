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
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { 
  getProviderAccounts, 
  verifyProviderAccount,
  deleteProviderAccount 
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { AddProviderModal } from './AddProviderModal';
import type { CredentialStatus } from '@machine/shared';

const providerIcons: Record<string, string> = {
  digitalocean: '🌊',
  aws: '☁️',
  gcp: '🔷',
  hetzner: '🏢',
  baremetal: '🖥️',
};

const credentialStatusConfig: Record<CredentialStatus, { icon: typeof Check; class: string; label: string }> = {
  valid: { icon: Check, class: 'text-status-running', label: 'Valid' },
  invalid: { icon: X, class: 'text-status-error', label: 'Invalid' },
  expired: { icon: AlertCircle, class: 'text-status-warning', label: 'Expired' },
  unchecked: { icon: AlertCircle, class: 'text-text-tertiary', label: 'Unchecked' },
};

export function ProvidersPage() {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: accounts, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['provider-accounts'],
    queryFn: getProviderAccounts,
  });

  const verifyMutation = useMutation({
    mutationFn: verifyProviderAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Credentials verified', message: 'Your API token is valid' });
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-machine-border bg-black px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-text-primary">Provider Accounts</h1>
          <span className="text-sm text-text-tertiary font-mono">
            {accounts?.length ?? 0} configured
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
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Accounts List */}
        <div>
          <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-4">
            Configured Accounts
          </h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-text-secondary animate-pulse">Loading providers...</span>
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => {
                const status = credentialStatusConfig[account.credential_status];
                const StatusIcon = status.icon;

                return (
                  <div key={account.provider_account_id} className="card">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-machine-elevated border border-machine-border flex items-center justify-center text-2xl">
                        {providerIcons[account.provider_type] || '☁️'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-text-primary">{account.label}</h3>
                          <span className={clsx('flex items-center gap-1 text-xs font-medium', status.class)}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-text-secondary">
                          <span className="capitalize">{account.provider_type}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Created {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                          </span>
                          {account.last_verified_at && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5" />
                              Verified {formatDistanceToNow(new Date(account.last_verified_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setVerifyingId(account.provider_account_id);
                            verifyMutation.mutate(account.provider_account_id);
                          }}
                          disabled={verifyingId === account.provider_account_id}
                          className="btn btn-secondary btn-sm"
                        >
                          {verifyingId === account.provider_account_id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                          {verifyingId === account.provider_account_id ? 'Verifying...' : 'Verify'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete provider account "${account.label}"?`)) {
                              setDeletingId(account.provider_account_id);
                              deleteMutation.mutate(account.provider_account_id);
                            }
                          }}
                          disabled={deletingId === account.provider_account_id}
                          className="btn btn-danger btn-sm"
                        >
                          {deletingId === account.provider_account_id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-machine-elevated border border-machine-border flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-text-tertiary" />
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-1">No provider accounts</h3>
              <p className="text-text-secondary mb-4">Add a provider account to start deploying machines.</p>
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                <Plus className="w-4 h-4" />
                Add Provider
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Provider Modal */}
      {showAddModal && (
        <AddProviderModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

