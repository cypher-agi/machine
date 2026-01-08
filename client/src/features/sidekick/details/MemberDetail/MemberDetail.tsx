import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, User, UserMinus } from 'lucide-react';
import { getMember, getMembers, updateTeamMemberRole, removeTeamMember } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, Modal } from '@/shared/ui';
import {
  SidekickHeader,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
} from '../../components';
import { MemberOverview } from './MemberOverview';
import styles from './MemberDetail.module.css';

export interface MemberDetailProps {
  memberId: string;
  onClose: () => void;
  onMinimize: () => void;
}

export function MemberDetail({ memberId, onClose, onMinimize }: MemberDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const { currentTeamId, user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => getMember(memberId),
  });

  // Get current user's role to determine if they can manage this member
  const { data: currentMemberData } = useQuery({
    queryKey: ['member', currentTeamId, currentUser?.user_id],
    queryFn: async () => {
      // Find current user in members list
      const members = await queryClient.fetchQuery({
        queryKey: ['members', currentTeamId, {}],
        queryFn: () => getMembers(),
      });
      return members?.find((m) => m.user_id === currentUser?.user_id);
    },
    enabled: !!currentUser,
  });

  const isAdmin = currentMemberData?.role === 'admin';
  const isSelf = member?.user_id === currentUser?.user_id;
  const canManage = isAdmin && !isSelf;

  const roleMutation = useMutation({
    mutationFn: ({ role }: { role: 'admin' | 'member' }) =>
      updateTeamMemberRole(currentTeamId ?? '', memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      addToast({ type: 'success', title: 'Role updated' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to update role', message: error.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeTeamMember(currentTeamId ?? '', memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      addToast({ type: 'success', title: 'Member removed' });
      setSidekickSelection(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to remove member', message: error.message });
    },
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!member || !member.user) {
    return <SidekickLoading message="Member not found" />;
  }

  const handleToggleRole = () => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    roleMutation.mutate({ role: newRole });
  };

  const handleRemove = () => {
    removeMutation.mutate();
    setShowRemoveConfirm(false);
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
    <>
      <SidekickHeader
        {...(member.user.profile_picture_url
          ? {
              icon: (
                <img
                  src={member.user.profile_picture_url}
                  alt={member.user.display_name}
                  className={styles.avatarLarge}
                />
              ),
            }
          : { iconText: getInitials(member.user.display_name) })}
        name={member.user.display_name}
        nameSans
        subtitle={member.user.email}
        statusBadge={
          <span
            className={`${styles.roleBadge} ${
              member.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeMember
            }`}
          >
            {member.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
            {member.role === 'admin' ? 'Admin' : 'Member'}
          </span>
        }
        onClose={onClose}
        onMinimize={onMinimize}
      />

      <SidekickContent>
        <MemberOverview member={member} />
      </SidekickContent>

      {canManage && (
        <SidekickActionBar>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleRole}
            disabled={roleMutation.isPending}
            className={styles.actionButton}
          >
            {member.role === 'admin' ? <User size={14} /> : <Shield size={14} />}
            {member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRemoveConfirm(true)}
            className={styles.dangerButton}
          >
            <UserMinus size={14} />
            Remove
          </Button>
        </SidekickActionBar>
      )}

      {showRemoveConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowRemoveConfirm(false)}
          title="Remove Member"
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowRemoveConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRemove}
                className={styles.dangerButton}
              >
                Remove
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>
            Are you sure you want to remove <strong>{member.user.display_name}</strong> from this
            team?
            <span className={styles.warningText}>They will lose access to all team resources.</span>
          </p>
        </Modal>
      )}
    </>
  );
}
