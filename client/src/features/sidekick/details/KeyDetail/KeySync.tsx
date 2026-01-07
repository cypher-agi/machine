import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Cloud, RefreshCw } from 'lucide-react';
import { syncSSHKeyToProvider, unsyncSSHKeyFromProvider } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/shared/ui';
import { PROVIDER_FULL_LABELS } from '@/shared/constants';
import type { SSHKey, ProviderAccount } from '@machina/shared';
import { SidekickPanel, SidekickSection } from '../../components';
import styles from './KeyDetail.module.css';

interface KeySyncProps {
  sshKey: SSHKey;
  providerAccounts: ProviderAccount[];
}

export function KeySync({ sshKey, providerAccounts }: KeySyncProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: ({ keyId, providerAccountId }: { keyId: string; providerAccountId: string }) =>
      syncSSHKeyToProvider(keyId, providerAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      addToast({ type: 'success', title: 'Key synced' });
      setSyncingProvider(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Sync failed', message: error.message });
      setSyncingProvider(null);
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

  const syncedTypes = Object.keys(sshKey.provider_key_ids);
  const syncableProviders = providerAccounts.filter(
    (a) => !syncedTypes.includes(a.provider_type) && a.credential_status === 'valid'
  );

  return (
    <SidekickPanel>
      {syncedTypes.length > 0 && (
        <SidekickSection title="Synced Providers">
          {syncedTypes.map((providerType) => (
            <div key={providerType} className={styles.row}>
              <span className={styles.label}>
                <Cloud size={12} />
                {PROVIDER_FULL_LABELS[providerType] || providerType}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unsyncMutation.mutate({ keyId: sshKey.ssh_key_id, providerType })}
                className={styles.dangerButton}
              >
                Remove
              </Button>
            </div>
          ))}
        </SidekickSection>
      )}

      {syncableProviders.length > 0 && (
        <SidekickSection title="Available Providers">
          {syncableProviders.map((account) => (
            <div key={account.provider_account_id} className={styles.row}>
              <span className={styles.label}>
                <Cloud size={12} />
                {account.label}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSyncingProvider(account.provider_account_id);
                  syncMutation.mutate({
                    keyId: sshKey.ssh_key_id,
                    providerAccountId: account.provider_account_id,
                  });
                }}
                disabled={syncingProvider === account.provider_account_id}
              >
                {syncingProvider === account.provider_account_id ? (
                  <RefreshCw size={14} className={styles.spinning} />
                ) : (
                  'Sync'
                )}
              </Button>
            </div>
          ))}
        </SidekickSection>
      )}

      {syncedTypes.length === 0 && syncableProviders.length === 0 && (
        <div className={styles.emptyState}>
          <Cloud size={32} className={styles.emptyIconMuted} />
          <span className={styles.emptyText}>
            No provider accounts available for syncing.
            <br />
            Add a provider account first.
          </span>
        </div>
      )}
    </SidekickPanel>
  );
}
