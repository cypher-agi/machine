import { useQuery } from '@tanstack/react-query';
import { Plus, Lock } from 'lucide-react';
import { getBootstrapProfiles } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, Badge, RefreshButton } from '@/shared/ui';
import {
  PageLayout,
  PageEmptyState,
  PageList,
  ItemCard,
  ItemCardMeta,
  ItemCardBadge,
  ItemCardTypeBadge,
} from '@/shared/components';
import { BOOTSTRAP_METHOD_ICONS, BOOTSTRAP_METHOD_LABELS } from '@/shared/constants';
import styles from './BootstrapApp.module.css';

export function BootstrapApp() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();
  const { currentTeamId } = useAuthStore();

  const {
    data: profiles,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['bootstrap-profiles', currentTeamId],
    queryFn: getBootstrapProfiles,
  });

  const handleSelectProfile = (profileId: string) => {
    setSidekickSelection({ type: 'bootstrap', id: profileId });
  };

  return (
    <PageLayout
      title="Bootstrap Profiles"
      count={profiles?.length ?? 0}
      isLoading={isLoading}
      loadingText="Loading profiles..."
      actions={
        <>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isRefetching} />
          <Button variant="primary" size="sm">
            <Plus size={14} />
            New Profile
          </Button>
        </>
      }
    >
      {profiles && profiles.length > 0 ? (
        <PageList>
          {profiles.map((profile) => {
            const MethodIcon = BOOTSTRAP_METHOD_ICONS[profile.method];
            const isSelected =
              sidekickSelection?.type === 'bootstrap' &&
              sidekickSelection?.id === profile.profile_id;

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
                      <Badge variant="pending">
                        <Lock size={10} className={styles.badgeIcon} />
                        System
                      </Badge>
                    )}
                    <ItemCardTypeBadge>{BOOTSTRAP_METHOD_LABELS[profile.method]}</ItemCardTypeBadge>
                  </>
                }
                meta={<ItemCardMeta>{profile.description || 'No description'}</ItemCardMeta>}
                badges={
                  profile.services_to_run.length > 0 ? (
                    <>
                      {profile.services_to_run
                        .slice(0, 3)
                        .map((svc: { service_name: string; display_name: string }) => (
                          <ItemCardBadge key={svc.service_name}>{svc.display_name}</ItemCardBadge>
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
        </PageList>
      ) : (
        <PageEmptyState
          title="No bootstrap profiles"
          actions={
            <Button variant="primary" size="sm">
              <Plus size={14} />
              New Profile
            </Button>
          }
        />
      )}
    </PageLayout>
  );
}
