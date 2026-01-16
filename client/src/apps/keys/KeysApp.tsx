import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Key, Clock, Upload, Fingerprint } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getSSHKeys } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, RefreshButton } from '@/shared/ui';
import {
  Page,
  PageEmptyState,
  PageList,
  ItemCard,
  ItemCardMeta,
  ItemCardBadge,
  ItemCardTypeBadge,
} from '@/shared';
import { GenerateKeyModal } from './components/GenerateKeyModal';
import { ImportKeyModal } from './components/ImportKeyModal';
import { KEY_TYPE_LABELS, PROVIDER_LABELS } from '@/shared/constants';

export function KeysApp() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();
  const { currentTeamId } = useAuthStore();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const {
    data: keys,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['ssh-keys', currentTeamId],
    queryFn: getSSHKeys,
  });

  const handleSelectKey = (keyId: string) => {
    setSidekickSelection({ type: 'key', id: keyId });
  };

  return (
    <Page
      title="SSH Keys"
      count={keys?.length ?? 0}
      isLoading={isLoading}
      actions={
        <>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isRefetching} />
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload size={14} />
            Import
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowGenerateModal(true)}>
            <Plus size={14} />
            Generate
          </Button>
        </>
      }
    >
      {keys && keys.length > 0 ? (
        <PageList>
          {keys.map((key) => {
            const isSelected =
              sidekickSelection?.type === 'key' && sidekickSelection?.id === key.ssh_key_id;
            const syncedProviders = Object.keys(key.provider_key_ids);

            return (
              <ItemCard
                key={key.ssh_key_id}
                selected={isSelected}
                onClick={() => handleSelectKey(key.ssh_key_id)}
                iconBadge={<Key size={14} />}
                title={key.name}
                titleSans
                statusBadge={<ItemCardTypeBadge>{KEY_TYPE_LABELS[key.key_type]}</ItemCardTypeBadge>}
                meta={
                  <>
                    <ItemCardMeta mono>
                      <Fingerprint size={12} />
                      {key.fingerprint.slice(0, 16)}...
                    </ItemCardMeta>
                    <ItemCardMeta>
                      <Clock size={12} />
                      {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                    </ItemCardMeta>
                  </>
                }
                badges={
                  syncedProviders.length > 0 ? (
                    <>
                      {syncedProviders.map((provider) => (
                        <ItemCardBadge key={provider}>
                          {PROVIDER_LABELS[provider] || provider}
                        </ItemCardBadge>
                      ))}
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </PageList>
      ) : (
        <PageEmptyState
          title="No SSH keys"
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                <Upload size={14} />
                Import
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowGenerateModal(true)}>
                <Plus size={14} />
                Generate
              </Button>
            </>
          }
        />
      )}

      {/* Modals */}
      {showGenerateModal && <GenerateKeyModal onClose={() => setShowGenerateModal(false)} />}
      {showImportModal && <ImportKeyModal onClose={() => setShowImportModal(false)} />}
    </Page>
  );
}
