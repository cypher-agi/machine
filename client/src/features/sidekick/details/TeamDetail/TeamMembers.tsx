import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserMinus, Shield, User } from 'lucide-react';
import type { TeamMemberWithUser } from '@machina/shared';
import { removeTeamMember, updateTeamMemberRole } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/shared/ui';
import { SidekickSection } from '../../components';
import styles from './TeamDetail.module.css';

interface TeamMembersProps {
  teamId: string;
  members: TeamMemberWithUser[];
  isAdmin: boolean;
}

export function TeamMembers({ teamId, members, isAdmin }: TeamMembersProps) {
  const { addToast } = useAppStore();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeTeamMember(teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      addToast({ type: 'success', title: 'Member removed' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to remove member', message: error.message });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'admin' | 'member' }) =>
      updateTeamMemberRole(teamId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      addToast({ type: 'success', title: 'Role updated' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to update role', message: error.message });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleToggleRole = (member: TeamMemberWithUser) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    roleMutation.mutate({ memberId: member.team_member_id, role: newRole });
  };

  return (
    <SidekickSection title="Team Members">
      <div className={styles.membersList}>
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUser?.user_id;
          const canModify = isAdmin && !isCurrentUser;

          return (
            <div key={member.team_member_id} className={styles.memberItem}>
              <div className={styles.memberAvatar}>
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
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>
                  {member.user.display_name}
                  {isCurrentUser && <span className={styles.youBadge}>(you)</span>}
                </div>
                <div className={styles.memberEmail}>{member.user.email}</div>
              </div>
              <span
                className={`${styles.memberRole} ${
                  member.role === 'admin' ? styles.memberRoleAdmin : styles.memberRoleMember
                }`}
              >
                {member.role === 'admin' ? 'Admin' : 'Member'}
              </span>
              {canModify && (
                <div className={styles.memberActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => handleToggleRole(member)}
                    title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                  >
                    {member.role === 'admin' ? <User size={14} /> : <Shield size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => removeMutation.mutate(member.team_member_id)}
                    title="Remove from team"
                    className={styles.dangerButton}
                  >
                    <UserMinus size={14} />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SidekickSection>
  );
}
