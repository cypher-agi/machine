import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Trash2, Edit } from 'lucide-react';
import { getBootstrapProfiles, deleteBootstrapProfile, getMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Badge, Button, ConfirmModal } from '@/shared/ui';
import { BOOTSTRAP_METHOD_ICONS } from '@/shared/constants';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
} from '../../components';
import { BootstrapOverview } from './BootstrapOverview';
import { BootstrapTemplate } from './BootstrapTemplate';
import { BootstrapMachines } from './BootstrapMachines';
import { BootstrapDetails } from './BootstrapDetails';
import styles from './BootstrapDetail.module.css';

export interface BootstrapDetailProps {
  profileId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

type TabId = 'overview' | 'template' | 'machines' | 'details';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'template', label: 'Template' },
  { id: 'machines', label: 'Machines' },
  { id: 'details', label: 'Details' },
];

export function BootstrapDetail({ profileId, onClose, onMinimize }: BootstrapDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['bootstrap-profiles'],
    queryFn: getBootstrapProfiles,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => getMachines(),
  });

  const profile = profiles?.find((p) => p.profile_id === profileId);

  const deleteMutation = useMutation({
    mutationFn: deleteBootstrapProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bootstrap-profiles'] });
      addToast({ type: 'success', title: 'Profile deleted' });
      setSidekickSelection(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
    },
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!profile) {
    return <SidekickLoading message="Profile not found" />;
  }

  const MethodIcon = BOOTSTRAP_METHOD_ICONS[profile.method];
  const profileMachines = machines?.filter((m) => m.bootstrap_profile_id === profileId) || [];

  const handleDelete = () => {
    deleteMutation.mutate(profileId);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <SidekickHeader
        icon={<MethodIcon size={18} />}
        name={profile.name}
        nameSans
        subtitle={profile.description || 'No description'}
        statusBadge={
          profile.is_system_profile ? (
            <Badge variant="pending">
              <Lock size={10} className={styles.badgeIcon} />
              System
            </Badge>
          ) : undefined
        }
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
          <BootstrapOverview 
            profile={profile} 
            machineCount={profileMachines.length}
          />
        )}
        {activeTab === 'template' && (
          <BootstrapTemplate profile={profile} />
        )}
        {activeTab === 'machines' && (
          <BootstrapMachines machines={profileMachines} />
        )}
        {activeTab === 'details' && (
          <BootstrapDetails profile={profile} />
        )}
      </SidekickContent>

      {!profile.is_system_profile && (
        <SidekickActionBar spread>
          <Button variant="secondary" size="sm">
            <Edit size={14} />
            Edit
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
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Bootstrap Profile"
        message={
          <>
            Are you sure you want to delete <strong>{profile.name}</strong>?
            {profileMachines.length > 0 && (
              <span className={styles.warningText}>
                {profileMachines.length} machine(s) are using this profile.
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
