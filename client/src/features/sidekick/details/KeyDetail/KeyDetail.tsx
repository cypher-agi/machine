import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Copy, Download, Trash2 } from 'lucide-react';
import { getSSHKeys, deleteSSHKey, getSSHKeyPrivate, getProviderAccounts } from '@/lib/api';
import { copyToClipboard, downloadTextFile } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import { Badge, Button, ConfirmModal } from '@/shared/ui';
import { KEY_TYPE_LABELS } from '@/shared/constants';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
} from '../../components';
import { KeyOverview } from './KeyOverview';
import { KeySync } from './KeySync';
import { KeyDetails } from './KeyDetails';
import styles from './KeyDetail.module.css';

export interface KeyDetailProps {
  keyId: string;
  onClose: () => void;
  onMinimize: () => void;
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
      const filename = `${sshKey.name.replace(/\s+/g, '_')}_id_${sshKey.key_type}`;
      downloadTextFile(private_key, filename);
      addToast({ type: 'success', title: 'Downloaded' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', title: 'Download failed', message });
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
          <KeySync sshKey={sshKey} providerAccounts={providerAccounts || []} />
        )}
        {activeTab === 'details' && <KeyDetails sshKey={sshKey} />}
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
          <Button variant="secondary" size="sm" onClick={downloadPrivateKey}>
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
              <span className={styles.warningText}>
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
