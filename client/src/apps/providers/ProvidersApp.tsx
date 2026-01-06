import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Clock, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getProviderAccounts, verifyProviderAccount } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button, RefreshButton } from '@/shared/ui';
import { 
  PageLayout, 
  PageEmptyState, 
  PageList, 
  ItemCard, 
  ItemCardMeta, 
  ItemCardStatus 
} from '@/shared/components';
import { AddProviderModal } from './components/AddProviderModal';
import { PROVIDER_LABELS, CREDENTIAL_STATUS_CONFIG } from '@/shared/constants';

export function ProvidersApp() {
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
    <PageLayout
      title="Providers"
      count={accounts?.length ?? 0}
      isLoading={isLoading}
      actions={
        <>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isRefetching} />
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            Add
          </Button>
        </>
      }
    >
      {accounts && accounts.length > 0 ? (
        <PageList>
          {accounts.map((account) => {
            const status = CREDENTIAL_STATUS_CONFIG[account.credential_status];
            const StatusIcon = status.icon;
            const isSelected = sidekickSelection?.type === 'provider' && sidekickSelection?.id === account.provider_account_id;

            return (
              <ItemCard
                key={account.provider_account_id}
                selected={isSelected}
                onClick={() => handleSelectProvider(account.provider_account_id)}
                iconBadge={PROVIDER_LABELS[account.provider_type] || '??'}
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
        </PageList>
      ) : (
        <PageEmptyState
          title="No provider accounts"
          actions={
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus size={14} />
              Add Provider
            </Button>
          }
        />
      )}

      {/* Add Provider Modal */}
      {showAddModal && <AddProviderModal onClose={() => setShowAddModal(false)} />}
    </PageLayout>
  );
}


