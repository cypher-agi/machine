import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users, UserPlus } from 'lucide-react';
import { getTeams } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Avatar, Button, RefreshButton } from '@/shared/ui';
import { Page, PageEmptyState, PageList, ItemCard, ItemCardMeta } from '@/shared/components';
import { CreateTeamModal } from './components/CreateTeamModal';
import { JoinTeamModal } from './components/JoinTeamModal';
import styles from './TeamsApp.module.css';

export function TeamsApp() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const {
    data: teams,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  });

  const handleSelectTeam = (teamId: string) => {
    setSidekickSelection({ type: 'team', id: teamId });
  };

  return (
    <Page
      title="Teams"
      count={teams?.length ?? 0}
      isLoading={isLoading}
      actions={
        <>
          <RefreshButton onRefresh={() => refetch()} isRefreshing={isRefetching} />
          <Button variant="secondary" size="sm" onClick={() => setShowJoinModal(true)}>
            <UserPlus size={14} />
            Join
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            Create
          </Button>
        </>
      }
    >
      {teams && teams.length > 0 ? (
        <PageList>
          {teams.map((team) => {
            const isSelected =
              sidekickSelection?.type === 'team' && sidekickSelection?.id === team.team_id;

            return (
              <ItemCard
                key={team.team_id}
                selected={isSelected}
                onClick={() => handleSelectTeam(team.team_id)}
                iconBadge={
                  <Avatar
                    name={team.name}
                    src={team.avatar_url}
                    size="lg"
                    square
                    className={styles.avatarBadge}
                  />
                }
                title={team.name}
                titleSans
                subtitle={<span className={styles.handleText}>@{team.handle}</span>}
                statusBadge={
                  <span
                    className={`${styles.roleBadge} ${
                      team.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeMember
                    }`}
                  >
                    {team.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                }
                meta={
                  <ItemCardMeta>
                    <Users size={12} />
                    {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                  </ItemCardMeta>
                }
              />
            );
          })}
        </PageList>
      ) : (
        <PageEmptyState
          title="No teams yet"
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowJoinModal(true)}>
                <UserPlus size={14} />
                Join Team
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus size={14} />
                Create Team
              </Button>
            </>
          }
        />
      )}

      {/* Modals */}
      {showCreateModal && <CreateTeamModal onClose={() => setShowCreateModal(false)} />}
      {showJoinModal && <JoinTeamModal onClose={() => setShowJoinModal(false)} />}
    </Page>
  );
}
