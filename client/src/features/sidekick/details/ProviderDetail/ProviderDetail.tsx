import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Trash2, RefreshCw } from 'lucide-react';
import {
  getProviderAccounts,
  verifyProviderAccount,
  deleteProviderAccount,
  getMachines,
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Badge, Button, Modal } from '@/shared';
import {
  PROVIDER_LABELS,
  PROVIDER_FULL_LABELS,
  CREDENTIAL_STATUS_BADGE_CONFIG,
} from '@/shared/constants';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
} from '../../components';
import { ProviderOverview } from './ProviderOverview';
import { ProviderMachines } from './ProviderMachines';
import { ProviderDetails } from './ProviderDetails';
import styles from './ProviderDetail.module.css';

export interface ProviderDetailProps {
  providerId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

type TabId = 'overview' | 'machines' | 'details';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'machines', label: 'Machines' },
  { id: 'details', label: 'Details' },
];

export function ProviderDetail({ providerId, onClose, onMinimize }: ProviderDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const { currentTeamId } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['provider-accounts', currentTeamId],
    queryFn: getProviderAccounts,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines', currentTeamId],
    queryFn: () => getMachines(),
  });

  const account = accounts?.find((a) => a.provider_account_id === providerId);

  const verifyMutation = useMutation({
    mutationFn: verifyProviderAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Verified', message: 'Credentials are valid' });
      setIsVerifying(false);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Verification failed', message: error.message });
      setIsVerifying(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProviderAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Provider deleted' });
      setSidekickSelection(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
    },
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!account) {
    return <SidekickLoading message="Provider not found" />;
  }

  const status = CREDENTIAL_STATUS_BADGE_CONFIG[account.credential_status];
  const providerMachines = machines?.filter((m) => m.provider_account_id === providerId) || [];

  const handleVerify = () => {
    setIsVerifying(true);
    verifyMutation.mutate(providerId);
  };

  const handleDelete = () => {
    deleteMutation.mutate(providerId);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <SidekickHeader
        iconText={PROVIDER_LABELS[account.provider_type] || '??'}
        name={account.label}
        nameSans
        subtitle={PROVIDER_FULL_LABELS[account.provider_type] || account.provider_type}
        statusBadge={<Badge variant={status.variant}>{status.label}</Badge>}
        onClose={onClose}
        onMinimize={onMinimize}
      />

      <SidekickTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <SidekickContent>
        {activeTab === 'overview' && (
          <ProviderOverview account={account} machineCount={providerMachines.length} />
        )}
        {activeTab === 'machines' && <ProviderMachines machines={providerMachines} />}
        {activeTab === 'details' && <ProviderDetails account={account} />}
      </SidekickContent>

      <SidekickActionBar spread>
        <Button variant="secondary" size="sm" onClick={handleVerify} disabled={isVerifying}>
          {isVerifying ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
          Verify
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className={styles.dangerButton}
        >
          <Trash2 size={14} />
          Delete
        </Button>
      </SidekickActionBar>

      {showDeleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Provider"
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDelete}
                className={styles.dangerButton}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>
            Are you sure you want to delete <strong>{account.label}</strong>?
            {providerMachines.length > 0 && (
              <span className={styles.warningText}>
                This provider has {providerMachines.length} machine(s) associated with it.
              </span>
            )}
          </p>
        </Modal>
      )}
    </>
  );
}
