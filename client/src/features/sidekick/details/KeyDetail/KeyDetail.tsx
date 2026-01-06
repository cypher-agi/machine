import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Copy, Download, Trash2, Clock, Fingerprint, Cloud, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  getSSHKeys, 
  deleteSSHKey, 
  getSSHKeyPrivate,
  getProviderAccounts,
  syncSSHKeyToProvider,
  unsyncSSHKeyFromProvider
} from '@/lib/api';
import { copyToClipboard } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import { Badge, Button, ConfirmModal } from '@/shared/ui';
import { KEY_TYPE_LABELS, PROVIDER_FULL_LABELS } from '@/shared/constants';
import type { SSHKey, ProviderAccount } from '@machina/shared';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickLoading,
  SidekickCode,
  SidekickActionBar,
  SidekickTags,
} from '../../components';
import styles from '../../Sidekick/Sidekick.module.css';

interface KeyDetailProps {
  keyId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

type TabId = 'overview' | 'sync' | 'details';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sync', label: 'Cloud Sync' },
  { id: 'details', label: 'Details' },
];

export function KeyDetail({ keyId, onClose, onMinimize }: KeyDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: getSSHKeys,
  });

  const { data: providerAccounts } = useQuery({
    queryKey: ['provider-accounts'],
    queryFn: getProviderAccounts,
  });

  const sshKey = keys?.find((k) => k.ssh_key_id === keyId);

  const deleteMutation = useMutation({
    mutationFn: deleteSSHKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      addToast({ type: 'success', title: 'Key deleted' });
      setSidekickSelection(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
    },
  });

  const handleCopy = async (text: string, label: string) => {
    try {
      await copyToClipboard(text);
      addToast({ type: 'success', title: 'Copied', message: `${label} copied` });
    } catch {
      addToast({ type: 'error', title: 'Copy failed' });
    }
  };

  const downloadPrivateKey = async () => {
    if (!sshKey) return;
    try {
      const { private_key } = await getSSHKeyPrivate(sshKey.ssh_key_id);
      const blob = new Blob([private_key], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sshKey.name.replace(/\s+/g, '_')}_id_${sshKey.key_type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Downloaded' });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Download failed', message: error.message });
    }
  };

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!sshKey) {
    return <SidekickLoading message="SSH Key not found" />;
  }

  const syncedProviders = Object.keys(sshKey.provider_key_ids);

  const handleDelete = () => {
    deleteMutation.mutate(keyId);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <SidekickHeader
        icon={<Key size={18} />}
        name={sshKey.name}
        nameSans
        subtitle={`${KEY_TYPE_LABELS[sshKey.key_type]} · ${sshKey.fingerprint.slice(0, 16)}...`}
        statusBadge={
          syncedProviders.length > 0 ? (
            <Badge variant="running">{syncedProviders.length} synced</Badge>
          ) : undefined
        }
        onClose={onClose}
        onMinimize={onMinimize}
        quickCode={sshKey.fingerprint}
        quickCodeLabel="Fingerprint"
      />

      <SidekickTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <SidekickContent>
        {activeTab === 'overview' && <KeyOverview sshKey={sshKey} />}
        {activeTab === 'sync' && (
          <KeySync 
            sshKey={sshKey} 
            providerAccounts={providerAccounts || []}
          />
        )}
        {activeTab === 'details' && (
          <KeyDetails sshKey={sshKey} />
        )}
      </SidekickContent>

      <SidekickActionBar spread>
        <div className={styles.actionGroup}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCopy(sshKey.public_key, 'Public key')}
          >
            <Copy size={14} />
            Copy
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadPrivateKey}
          >
            <Download size={14} />
            Download
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className={styles.dangerButton}
        >
          <Trash2 size={14} />
        </Button>
      </SidekickActionBar>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete SSH Key"
        message={
          <>
            Are you sure you want to delete <strong>{sshKey.name}</strong>?
            {syncedProviders.length > 0 && (
              <span style={{ display: 'block', marginTop: 'var(--space-2)', color: 'var(--color-warning)' }}>
                This key is synced to {syncedProviders.length} provider(s).
              </span>
            )}
          </>
        }
        confirmLabel="Delete"
        danger
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

function KeyOverview({ sshKey }: { sshKey: SSHKey }) {
  const syncedProviders = Object.keys(sshKey.provider_key_ids);

  return (
    <SidekickPanel>
      <SidekickSection title="Key Information">
        <SidekickRow 
          label="Type" 
          value={KEY_TYPE_LABELS[sshKey.key_type]}
        />
        <SidekickRow 
          label="Fingerprint" 
          value={sshKey.fingerprint}
          icon={<Fingerprint size={12} />}
          copyable
        />
        <SidekickRow 
          label="Created" 
          value={formatDistanceToNow(new Date(sshKey.created_at), { addSuffix: true })}
          icon={<Clock size={12} />}
        />
      </SidekickSection>

      {syncedProviders.length > 0 && (
        <SidekickSection title="Synced To" icon={<Cloud size={12} />}>
          <SidekickTags tags={syncedProviders.map(p => PROVIDER_FULL_LABELS[p] || p)} />
        </SidekickSection>
      )}

      <SidekickSection title="Public Key">
        <SidekickCode>{sshKey.public_key}</SidekickCode>
      </SidekickSection>
    </SidekickPanel>
  );
}

function KeySync({ sshKey, providerAccounts }: { sshKey: SSHKey; providerAccounts: ProviderAccount[] }) {
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
  const syncableProviders = providerAccounts.filter(a => 
    !syncedTypes.includes(a.provider_type) && 
    a.credential_status === 'valid'
  );

  return (
    <SidekickPanel>
      {syncedTypes.length > 0 && (
        <SidekickSection title="Synced Providers">
          {syncedTypes.map(providerType => (
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
          {syncableProviders.map(account => (
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
                    providerAccountId: account.provider_account_id 
                  });
                }}
                disabled={syncingProvider === account.provider_account_id}
              >
                {syncingProvider === account.provider_account_id ? (
                  <RefreshCw size={14} className="animate-spin" />
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

function KeyDetails({ sshKey }: { sshKey: SSHKey }) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="SSH Key ID" value={sshKey.ssh_key_id} copyable />
        <SidekickRow label="Fingerprint" value={sshKey.fingerprint} copyable />
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Name" value={sshKey.name} />
        <SidekickRow label="Key Type" value={KEY_TYPE_LABELS[sshKey.key_type]} />
      </SidekickSection>

      <SidekickSection title="Provider Sync">
        {Object.entries(sshKey.provider_key_ids).map(([provider, id]) => (
          <SidekickRow key={provider} label={PROVIDER_FULL_LABELS[provider] || provider} value={id as string} copyable />
        ))}
        {Object.keys(sshKey.provider_key_ids).length === 0 && (
          <SidekickRow label="Status" value="Not synced to any provider" />
        )}
      </SidekickSection>

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(sshKey.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(sshKey.updated_at), 'PPpp')} />
      </SidekickSection>
    </SidekickPanel>
  );
}
