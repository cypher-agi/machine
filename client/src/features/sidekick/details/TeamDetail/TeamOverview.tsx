import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Users, Calendar, AtSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Team } from '@machina/shared';
import { uploadTeamAvatar, deleteTeamAvatar } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/shared/ui';
import { SidekickSection, SidekickRow } from '../../components';
import styles from './TeamDetail.module.css';

interface TeamOverviewProps {
  team: Team;
  memberCount: number;
  isAdmin: boolean;
}

export function TeamOverview({ team, memberCount, isAdmin }: TeamOverviewProps) {
  const { addToast } = useAppStore();
  const { loadTeams } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadTeamAvatar(team.team_id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', team.team_id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      // Refresh teams in auth store so TeamSelector updates
      loadTeams();
      addToast({ type: 'success', title: 'Avatar updated' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Upload failed', message: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTeamAvatar(team.team_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', team.team_id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      // Refresh teams in auth store so TeamSelector updates
      loadTeams();
      addToast({ type: 'success', title: 'Avatar removed' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Remove failed', message: error.message });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        addToast({ type: 'error', title: 'File too large', message: 'Maximum size is 2MB' });
        return;
      }
      uploadMutation.mutate(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* Avatar Section */}
      <div className={styles.avatarSection}>
        <div className={styles.avatarLarge}>
          <Avatar name={team.name} src={team.avatar_url} size="xl" square />
          {isAdmin && (
            <div className={styles.avatarOverlay}>
              <button
                className={styles.avatarButton}
                onClick={() => fileInputRef.current?.click()}
                title="Upload avatar"
              >
                <Upload size={14} />
              </button>
              {team.avatar_url && (
                <button
                  className={styles.avatarButton}
                  onClick={() => deleteMutation.mutate()}
                  title="Remove avatar"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className={styles.avatarInput}
          />
        </div>
        <span className={styles.teamName}>{team.name}</span>
        <span className={styles.teamHandle}>@{team.handle}</span>
      </div>

      {/* Details */}
      <SidekickSection title="Details">
        <SidekickRow label="Handle" icon={<AtSign size={12} />} value={`@${team.handle}`} mono />
        <SidekickRow
          label="Members"
          icon={<Users size={12} />}
          value={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
        />
        <SidekickRow
          label="Created"
          icon={<Calendar size={12} />}
          value={formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}
        />
      </SidekickSection>
    </>
  );
}
