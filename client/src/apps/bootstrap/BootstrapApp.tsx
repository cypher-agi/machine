import { useQuery } from '@tanstack/react-query';
import { Plus, Package, Lock, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getBootstrapProfiles } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button, Badge, RefreshButton } from '@/shared/ui';
import { 
  PageLayout, 
  PageEmptyState, 
  PageList, 
  ItemCard, 
  ItemCardMeta, 
  ItemCardBadge, 
  ItemCardTypeBadge 
} from '@/shared/components';
import { BOOTSTRAP_METHOD_ICONS, BOOTSTRAP_METHOD_LABELS } from '@/shared/constants';

function BootstrapApp() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();

  const { data: profiles, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['bootstrap-profiles'],
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
                      <Badge variant="pending">
                        <Lock size={10} style={{ marginRight: 2 }} />
                        System
                      </Badge>
                    )}
                    <ItemCardTypeBadge>{BOOTSTRAP_METHOD_LABELS[profile.method]}</ItemCardTypeBadge>
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
        </PageList>
      ) : (
        <PageEmptyState
          large
          icon={<Package size={32} />}
          title="No bootstrap profiles"
          description="Create a profile to define what gets installed on your machines at boot."
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

export default BootstrapApp;

