import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, AlertCircle, Shield, Trash2, RefreshCw, Clock, Server } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getProviderAccounts, verifyProviderAccount, deleteProviderAccount, getMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Badge, Button, Modal } from '@/shared/ui';
import type { CredentialStatus, ProviderAccount } from '@machina/shared';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickLoading,
  SidekickEmpty,
  SidekickActionBar,
} from '../../Sidekick';
import styles from '../../Sidekick/Sidekick.module.css';

interface ProviderDetailProps {
  providerId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

const providerLabels: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
  baremetal: 'BM',
};

const providerFullLabels: Record<string, string> = {
  digitalocean: 'DigitalOcean',
  aws: 'Amazon Web Services',
  gcp: 'Google Cloud Platform',
  hetzner: 'Hetzner Cloud',
  baremetal: 'Bare Metal',
};

const credentialStatusConfig: Record<CredentialStatus, { label: string; variant: 'running' | 'stopped' | 'error' | 'pending' }> = {
  valid: { label: 'Valid', variant: 'running' },
  invalid: { label: 'Invalid', variant: 'error' },
  expired: { label: 'Expired', variant: 'stopped' },
  unchecked: { label: 'Unchecked', variant: 'pending' },
};

type TabId = 'overview' | 'machines' | 'details';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'machines', label: 'Machines' },
  { id: 'details', label: 'Details' },
];

export function ProviderDetail({ providerId, onClose, onMinimize }: ProviderDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['provider-accounts'],
    queryFn: getProviderAccounts,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines'],
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

  const status = credentialStatusConfig[account.credential_status];
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
        iconText={providerLabels[account.provider_type] || '??'}
        name={account.label}
        nameSans
        subtitle={providerFullLabels[account.provider_type] || account.provider_type}
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
          <ProviderOverview 
            account={account} 
            machineCount={providerMachines.length}
          />
        )}
        {activeTab === 'machines' && (
          <ProviderMachines machines={providerMachines} />
        )}
        {activeTab === 'details' && (
          <ProviderDetails account={account} />
        )}
      </SidekickContent>

      <SidekickActionBar spread>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Shield size={14} />
          )}
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

function ProviderOverview({ account, machineCount }: { account: ProviderAccount; machineCount: number }) {
  const StatusIcon = account.credential_status === 'valid' ? Check :
                     account.credential_status === 'invalid' ? X :
                     AlertCircle;

  return (
    <SidekickPanel>
      <SidekickSection title="Status">
        <SidekickRow 
          label="Credential Status" 
          value={account.credential_status}
          icon={<StatusIcon size={12} />}
        />
        {account.last_verified_at && (
          <SidekickRow 
            label="Last Verified" 
            value={formatDistanceToNow(new Date(account.last_verified_at), { addSuffix: true })}
          />
        )}
      </SidekickSection>

      <SidekickSection title="Usage">
        <SidekickRow 
          label="Machines" 
          value={machineCount.toString()}
          icon={<Server size={12} />}
        />
      </SidekickSection>

      <SidekickSection title="Information">
        <SidekickRow 
          label="Provider Type" 
          value={providerFullLabels[account.provider_type] || account.provider_type}
        />
        <SidekickRow 
          label="Created" 
          value={formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
          icon={<Clock size={12} />}
        />
      </SidekickSection>
    </SidekickPanel>
  );
}

function ProviderMachines({ machines }: { machines: any[] }) {
  const { setSidekickSelection } = useAppStore();

  if (!machines.length) {
    return <SidekickEmpty message="No machines using this provider" />;
  }

  return (
    <SidekickPanel>
      {machines.map((machine) => (
        <div 
          key={machine.machine_id} 
          className={styles.cardClickable}
          onClick={() => setSidekickSelection({ type: 'machine', id: machine.machine_id })}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>
                <span className={styles.cardNameMono}>
                  {machine.name}
                </span>
                <Badge variant={machine.actual_status === 'running' ? 'running' : 'stopped'}>
                  {machine.actual_status}
                </Badge>
              </div>
              <span className={styles.cardMeta}>
                {machine.region} · {machine.size}
              </span>
            </div>
          </div>
        </div>
      ))}
    </SidekickPanel>
  );
}

function ProviderDetails({ account }: { account: ProviderAccount }) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="Provider Account ID" value={account.provider_account_id} copyable />
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Label" value={account.label} />
        <SidekickRow label="Provider Type" value={account.provider_type} />
        <SidekickRow label="Credential Status" value={account.credential_status} />
      </SidekickSection>

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(account.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(account.updated_at), 'PPpp')} />
        {account.last_verified_at && (
          <SidekickRow label="Last Verified" value={format(new Date(account.last_verified_at), 'PPpp')} />
        )}
      </SidekickSection>
    </SidekickPanel>
  );
}

