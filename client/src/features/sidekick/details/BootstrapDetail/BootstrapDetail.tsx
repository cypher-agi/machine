import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Lock, Trash2, Edit, Clock, Tag, Server } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getBootstrapProfiles, deleteBootstrapProfile, getMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Badge, Button, ConfirmModal } from '@/shared/ui';
import { BOOTSTRAP_METHOD_ICONS, BOOTSTRAP_METHOD_LABELS } from '@/shared/constants';
import type { BootstrapProfile, Machine } from '@machina/shared';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickContentFull,
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickLoading,
  SidekickFullCode,
  SidekickTags,
  SidekickEmpty,
  SidekickActionBar,
} from '../../components';
import styles from '../../Sidekick/Sidekick.module.css';

interface BootstrapDetailProps {
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
              <span style={{ display: 'block', marginTop: 'var(--space-2)', color: 'var(--color-warning)' }}>
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

function BootstrapOverview({ profile, machineCount }: { profile: BootstrapProfile; machineCount: number }) {
  return (
    <SidekickPanel>
      <SidekickSection title="Configuration">
        <SidekickRow 
          label="Method" 
          value={BOOTSTRAP_METHOD_LABELS[profile.method]}
        />
        <SidekickRow 
          label="System Profile" 
          value={profile.is_system_profile ? 'Yes' : 'No'}
        />
        <SidekickRow 
          label="Machines Using" 
          value={machineCount.toString()}
          icon={<Server size={12} />}
        />
      </SidekickSection>

      {profile.description && (
        <SidekickSection title="Description">
          <p className={styles.description}>
            {profile.description}
          </p>
        </SidekickSection>
      )}

      {profile.services_to_run.length > 0 && (
        <SidekickSection title="Services">
          {profile.services_to_run.map((service) => (
            <div key={service.service_name} className={styles.row}>
              <span className={styles.label}>{service.display_name}</span>
              <span className={styles.value}>{service.service_name}</span>
            </div>
          ))}
        </SidekickSection>
      )}

      {profile.tags && profile.tags.length > 0 && (
        <SidekickSection title="Tags" icon={<Tag size={12} />}>
          <SidekickTags tags={profile.tags} />
        </SidekickSection>
      )}

      <SidekickSection title="Timestamps">
        <SidekickRow 
          label="Created" 
          value={formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
          icon={<Clock size={12} />}
        />
        <SidekickRow 
          label="Updated" 
          value={formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true })}
        />
      </SidekickSection>
    </SidekickPanel>
  );
}

function BootstrapTemplate({ profile }: { profile: BootstrapProfile }) {
  if (!profile.cloud_init_template && !profile.ssh_bootstrap_script) {
    return <SidekickEmpty icon={<Package size={32} />} message="No template configured" />;
  }

  // Determine the content and language
  const content = profile.cloud_init_template || profile.ssh_bootstrap_script || '';
  const language = profile.cloud_init_template ? 'yaml' : 'bash';
  const title = profile.cloud_init_template ? 'Cloud-Init Template' : 'SSH Script';

  return (
    <SidekickContentFull>
      <SidekickFullCode language={language} title={title}>
        {content}
      </SidekickFullCode>
    </SidekickContentFull>
  );
}

function BootstrapMachines({ machines }: { machines: Machine[] }) {
  const { setSidekickSelection } = useAppStore();

  if (!machines.length) {
    return <SidekickEmpty icon={<Server size={32} />} message="No machines using this profile" />;
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

function BootstrapDetails({ profile }: { profile: BootstrapProfile }) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="Profile ID" value={profile.profile_id} copyable />
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Name" value={profile.name} />
        <SidekickRow label="Method" value={profile.method} />
        <SidekickRow label="System Profile" value={profile.is_system_profile ? 'Yes' : 'No'} />
      </SidekickSection>

      {profile.services_to_run.length > 0 && (
        <SidekickSection title="Services Configuration">
          {profile.services_to_run.map((service, idx) => (
            <SidekickRow 
              key={idx} 
              label={service.display_name} 
              value={service.service_name}
            />
          ))}
        </SidekickSection>
      )}

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(profile.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(profile.updated_at), 'PPpp')} />
      </SidekickSection>

      {profile.tags && profile.tags.length > 0 && (
        <SidekickSection title="Tags (Raw)">
          <div className={styles.tags}>
            {profile.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                <span className={styles.tagSimple}>{tag}</span>
              </span>
            ))}
          </div>
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
