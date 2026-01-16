import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Users } from 'lucide-react';
import { getTeam, deleteTeam } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, Modal } from '@/shared';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
} from '../../components';
import { TeamOverview } from './TeamOverview';
import { TeamMembers } from './TeamMembers';
import { TeamSettings } from './TeamSettings';
import styles from './TeamDetail.module.css';

export interface TeamDetailProps {
  teamId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

type TabId = 'overview' | 'members' | 'settings';

export function TeamDetail({ teamId, onClose, onMinimize }: TeamDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const { loadTeams } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      // Refresh teams in auth store so TeamSelector updates
      loadTeams();
      addToast({ type: 'success', title: 'Team deleted' });
      setSidekickSelection(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
    },
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!data) {
    return <SidekickLoading message="Team not found" />;
  }

  const { team, members, pending_invites, current_user_role } = data;
  const isAdmin = current_user_role === 'admin';

  // Build tabs - settings only visible to admins
  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
    ...(isAdmin ? [{ id: 'settings' as TabId, label: 'Settings' }] : []),
  ];

  const handleDelete = () => {
    deleteMutation.mutate(teamId);
    setShowDeleteConfirm(false);
  };

  // Generate initials from team name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <SidekickHeader
        {...(team.avatar_url
          ? {
              icon: (
                <img
                  src={team.avatar_url}
                  alt={team.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }}
                />
              ),
            }
          : { iconText: getInitials(team.name) })}
        name={team.name}
        nameSans
        subtitle={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
        statusBadge={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              background: isAdmin ? 'var(--status-running-bg)' : 'var(--surface-2)',
              color: isAdmin ? 'var(--status-running)' : 'var(--text-secondary)',
            }}
          >
            <Users size={10} />
            {isAdmin ? 'Admin' : 'Member'}
          </span>
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
          <TeamOverview team={team} memberCount={members.length} isAdmin={isAdmin} />
        )}
        {activeTab === 'members' && (
          <TeamMembers teamId={teamId} members={members} isAdmin={isAdmin} />
        )}
        {activeTab === 'settings' && isAdmin && (
          <TeamSettings
            teamId={teamId}
            team={team}
            pendingInvites={pending_invites || []}
            onDeleteTeam={() => setShowDeleteConfirm(true)}
          />
        )}
      </SidekickContent>

      {isAdmin && (
        <SidekickActionBar spread>
          <div />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className={styles.dangerButton}
          >
            <Trash2 size={14} />
            Delete Team
          </Button>
        </SidekickActionBar>
      )}

      {showDeleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Team"
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
            Are you sure you want to delete <strong>{team.name}</strong>?
            {members.length > 1 && (
              <span className={styles.warningText}>
                This team has {members.length} members who will lose access.
              </span>
            )}
          </p>
        </Modal>
      )}
    </>
  );
}
