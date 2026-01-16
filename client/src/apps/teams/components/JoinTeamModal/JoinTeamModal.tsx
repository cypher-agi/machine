import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
import { joinTeam } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Modal, Button, Input } from '@/shared';
import styles from './JoinTeamModal.module.css';

export interface JoinTeamModalProps {
  onClose: () => void;
}

export function JoinTeamModal({ onClose }: JoinTeamModalProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const { loadTeams } = useAuthStore();
  const queryClient = useQueryClient();

  const [inviteCode, setInviteCode] = useState('');

  const joinMutation = useMutation({
    mutationFn: (code: string) => joinTeam(code),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      // Refresh teams in auth store so TeamSelector updates
      loadTeams();
      addToast({
        type: 'success',
        title: 'Joined team',
        message: `You are now a member of "${data.team.name}"`,
      });
      setSidekickSelection({ type: 'team', id: data.team.team_id });
      onClose();
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to join team', message: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim()) {
      addToast({ type: 'error', title: 'Validation error', message: 'Invite code is required' });
      return;
    }

    joinMutation.mutate(inviteCode.trim());
  };

  const canSubmit = inviteCode.trim().length > 0;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Join Team"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || joinMutation.isPending}
          >
            {joinMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <UserPlus size={14} />
                Join
              </>
            )}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Invite Code</label>
          <Input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Paste your invite code"
            autoFocus
            mono
            required
          />
          <p className={styles.hint}>Get an invite code from a team admin</p>
        </div>
      </form>
    </Modal>
  );
}
