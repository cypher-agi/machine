import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, 
  RefreshCw, 
  Key,
  Clock,
  Upload,
  Fingerprint,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getSSHKeys } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/shared/ui';
import { ItemCard, ItemCardMeta, ItemCardBadge, ItemCardTypeBadge } from '@/shared/components';
import { GenerateKeyModal } from './components/GenerateKeyModal';
import { ImportKeyModal } from './components/ImportKeyModal';
import type { SSHKeyType } from '@machina/shared';
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
  const { sidekickSelection, setSidekickSelection } = useAppStore();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: keys, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: getSSHKeys,
  });

  const handleSelectKey = (keyId: string) => {
    setSidekickSelection({ type: 'key', id: keyId });
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
              const isSelected = sidekickSelection?.type === 'key' && sidekickSelection?.id === key.ssh_key_id;
              const syncedProviders = Object.keys(key.provider_key_ids);

              return (
                <ItemCard
                  key={key.ssh_key_id}
                  selected={isSelected}
                  onClick={() => handleSelectKey(key.ssh_key_id)}
                  iconBadge={<Key size={14} />}
                  title={key.name}
                  titleSans
                  statusBadge={<ItemCardTypeBadge>{keyTypeLabels[key.key_type]}</ItemCardTypeBadge>}
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
                        {syncedProviders.map(provider => (
                          <ItemCardBadge key={provider}>
                            {providerLabels[provider] || provider}
                          </ItemCardBadge>
                        ))}
                      </>
                    ) : undefined
                  }
                />
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
