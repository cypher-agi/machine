import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Clock, Shield, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getMembers, getCurrentUserRole } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, Input, RefreshButton } from '@/shared/ui';
import { PageLayout, PageEmptyState, PageList, ItemCard, ItemCardMeta } from '@/shared/components';
import type { TeamRole } from '@machina/shared';
import clsx from 'clsx';
import styles from './MembersApp.module.css';

type RoleFilter = 'all' | 'admin' | 'member';

export function MembersApp() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();
  const { currentTeamId, user: currentUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Get current user's role in the team
  const { data: roleData } = useQuery({
    queryKey: ['current-role', currentTeamId],
    queryFn: getCurrentUserRole,
  });

  const isAdmin = roleData?.role === 'admin';

  // Build query params
  const queryParams = {
    ...(roleFilter !== 'all' && { role: roleFilter as TeamRole }),
    ...(searchQuery && { search: searchQuery }),
  };

  const {
    data: members,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['members', currentTeamId, queryParams],
    queryFn: () => getMembers(queryParams),
  });

  const handleSelectMember = (memberId: string) => {
    setSidekickSelection({ type: 'member', id: memberId });
  };

  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <PageLayout
      title="Members"
      count={members?.length ?? 0}
      isLoading={isLoading}
      actions={
        <>
          {/* Search */}
          <div className={styles.searchContainer}>
            <Search size={14} className={styles.searchIcon} />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              size="sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Role filter */}
          <div className={styles.filterGroup}>
            <button
              className={clsx(
                styles.filterButton,
                roleFilter === 'all' && styles.filterButtonActive
              )}
              onClick={() => setRoleFilter('all')}
            >
              All
            </button>
            <button
              className={clsx(
                styles.filterButton,
                roleFilter === 'admin' && styles.filterButtonActive
              )}
              onClick={() => setRoleFilter('admin')}
            >
              Admins
            </button>
            <button
              className={clsx(
                styles.filterButton,
                roleFilter === 'member' && styles.filterButtonActive
              )}
              onClick={() => setRoleFilter('member')}
            >
              Members
            </button>
          </div>

          {/* Refresh */}
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isRefetching} />

          {/* Invite button - only for admins */}
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                // Open team detail to settings tab for invites
                // For now, we'll just show a toast or could link to teams page
                // In future, could add InviteMemberModal
              }}
              title="Invite members via Teams page"
            >
              <UserPlus size={14} />
              Invite
            </Button>
          )}
        </>
      }
    >
      {members && members.length > 0 ? (
        <PageList>
          {members.map((member) => {
            const isSelected =
              sidekickSelection?.type === 'member' &&
              sidekickSelection?.id === member.team_member_id;
            const isCurrentUser = member.user_id === currentUser?.user_id;

            return (
              <ItemCard
                key={member.team_member_id}
                selected={isSelected}
                onClick={() => handleSelectMember(member.team_member_id)}
                iconBadge={
                  <div className={styles.avatarBadge}>
                    {member.user.profile_picture_url ? (
                      <img
                        src={member.user.profile_picture_url}
                        alt={member.user.display_name}
                        className={styles.avatarImage}
                      />
                    ) : (
                      getInitials(member.user.display_name)
                    )}
                  </div>
                }
                title={
                  isCurrentUser ? `${member.user.display_name} (you)` : member.user.display_name
                }
                titleSans
                statusBadge={
                  <span
                    className={clsx(
                      styles.roleBadge,
                      member.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeMember
                    )}
                  >
                    {member.role === 'admin' && <Shield size={10} />}
                    {member.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                }
                meta={
                  <>
                    <ItemCardMeta mono>
                      <span className={styles.emailText}>{member.user.email}</span>
                    </ItemCardMeta>
                    <ItemCardMeta>
                      <Clock size={12} />
                      Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                    </ItemCardMeta>
                  </>
                }
              />
            );
          })}
        </PageList>
      ) : (
        <PageEmptyState
          title={searchQuery || roleFilter !== 'all' ? 'No members found' : 'No members yet'}
        />
      )}
    </PageLayout>
  );
}
