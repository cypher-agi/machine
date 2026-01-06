import { useQuery } from '@tanstack/react-query';
import { 
  Plus, 
  RefreshCw, 
  Package,
  Lock,
  Cloud,
  Terminal,
  Play,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getBootstrapProfiles } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button, Badge } from '@/shared/ui';
import { ItemCard, ItemCardMeta, ItemCardBadge, ItemCardTypeBadge } from '@/shared/components';
import type { BootstrapMethod } from '@machina/shared';
import styles from './BootstrapPage.module.css';

const methodIcons: Record<BootstrapMethod, typeof Cloud> = {
  cloud_init: Cloud,
  ssh_script: Terminal,
  ansible: Play,
};

const methodLabels: Record<BootstrapMethod, string> = {
  cloud_init: 'Cloud-Init',
  ssh_script: 'SSH Script',
  ansible: 'Ansible',
};

function BootstrapPage() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();

  const { data: profiles, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['bootstrap-profiles'],
    queryFn: getBootstrapProfiles,
  });

  const handleSelectProfile = (profileId: string) => {
    setSidekickSelection({ type: 'bootstrap', id: profileId });
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Bootstrap Profiles</h1>
          <span className={styles.count}>{profiles?.length ?? 0}</span>
        </div>

        <div className={styles.headerRight}>
          <Button variant="ghost" size="sm" iconOnly onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" size="sm">
            <Plus size={14} />
            New Profile
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingText}>Loading profiles...</span>
          </div>
        ) : profiles && profiles.length > 0 ? (
          <div className={styles.list}>
            {profiles.map((profile) => {
              const MethodIcon = methodIcons[profile.method];
              const isSelected = sidekickSelection?.type === 'bootstrap' && sidekickSelection?.id === profile.profile_id;

              return (
                <ItemCard
                  key={profile.profile_id}
                  selected={isSelected}
                  onClick={() => handleSelectProfile(profile.profile_id)}
                  iconBadge={<MethodIcon size={14} />}
                  title={profile.name}
                  titleSans
                  statusBadge={
                    <>
                      {profile.is_system_profile && (
                        <Badge variant="pending" className={styles.systemBadge}>
                          <Lock size={10} className={styles.systemBadgeIcon} />
                          System
                        </Badge>
                      )}
                      <ItemCardTypeBadge>{methodLabels[profile.method]}</ItemCardTypeBadge>
                    </>
                  }
                  meta={
                    <>
                      <ItemCardMeta>
                        {profile.description || 'No description'}
                      </ItemCardMeta>
                      <ItemCardMeta>
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true })}
                      </ItemCardMeta>
                    </>
                  }
                  badges={
                    profile.services_to_run.length > 0 ? (
                      <>
                        {profile.services_to_run.slice(0, 3).map((svc: { service_name: string; display_name: string }) => (
                          <ItemCardBadge key={svc.service_name}>
                            {svc.display_name}
                          </ItemCardBadge>
                        ))}
                        {profile.services_to_run.length > 3 && (
                          <ItemCardBadge>+{profile.services_to_run.length - 3}</ItemCardBadge>
                        )}
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
              <div className={styles.emptyIcon}>
                <Package size={32} className={styles.emptyIconMuted} />
              </div>
              <div className={styles.emptyText}>
                <h3 className={styles.emptyTitle}>No bootstrap profiles</h3>
                <p className={styles.emptyDesc}>
                  Create a profile to define what gets installed on your machines at boot.
                </p>
                <Button variant="primary" size="sm">
                  <Plus size={14} />
                  New Profile
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BootstrapPage;
