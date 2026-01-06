import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Check, X, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getProviderAccounts, verifyProviderAccount } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/shared/ui';
import { ItemCard, ItemCardMeta, ItemCardStatus } from '@/shared/components';
import { AddProviderModal } from './components/AddProviderModal';
import type { CredentialStatus } from '@machina/shared';
import styles from './ProvidersPage.module.css';

const providerLabels: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
  baremetal: 'BM',
};

const credentialStatusConfig: Record<CredentialStatus, { icon: typeof Check; variant: 'valid' | 'invalid' | 'warning' | 'muted'; label: string }> = {
  valid: { icon: Check, variant: 'valid', label: 'Valid' },
  invalid: { icon: X, variant: 'invalid', label: 'Invalid' },
  expired: { icon: AlertCircle, variant: 'warning', label: 'Expired' },
  unchecked: { icon: AlertCircle, variant: 'muted', label: 'Unchecked' },
};

function ProvidersPage() {
  const { addToast, sidekickSelection, setSidekickSelection } = useAppStore();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

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

  const handleSelectProvider = (providerId: string) => {
    setSidekickSelection({ type: 'provider', id: providerId });
  };

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
              const isSelected = sidekickSelection?.type === 'provider' && sidekickSelection?.id === account.provider_account_id;

              return (
                <ItemCard
                  key={account.provider_account_id}
                  selected={isSelected}
                  onClick={() => handleSelectProvider(account.provider_account_id)}
                  iconBadge={providerLabels[account.provider_type] || '??'}
                  title={account.label}
                  titleSans
                  statusBadge={
                    <ItemCardStatus variant={status.variant}>
                      <StatusIcon size={12} />
                      {status.label}
                    </ItemCardStatus>
                  }
                  meta={
                    <>
                      <ItemCardMeta>
                        {account.provider_type.charAt(0).toUpperCase() + account.provider_type.slice(1)}
                      </ItemCardMeta>
                      <ItemCardMeta>
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                      </ItemCardMeta>
                    </>
                  }
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={(e) => {
                        e.stopPropagation();
                        setVerifyingId(account.provider_account_id);
                        verifyMutation.mutate(account.provider_account_id);
                      }}
                      disabled={verifyingId === account.provider_account_id}
                      title="Verify credentials"
                    >
                      {verifyingId === account.provider_account_id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                    </Button>
                  }
                />
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
    </div>
  );
}

export default ProvidersPage;
