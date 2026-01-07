import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Trash2, Check, Loader2, AtSign, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Team, TeamInvite } from '@machina/shared';
import { updateTeam, createTeamInvite, revokeTeamInvite, checkHandleAvailability } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button, Input } from '@/shared/ui';
import { SidekickSection } from '../../components';
import styles from './TeamDetail.module.css';

interface TeamSettingsProps {
  teamId: string;
  team: Team;
  pendingInvites: TeamInvite[];
  onDeleteTeam: () => void;
}

type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unchanged';

export function TeamSettings({ teamId, team, pendingInvites, onDeleteTeam }: TeamSettingsProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const [editName, setEditName] = useState(team.name);
  const [editHandle, setEditHandle] = useState(team.handle);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>('unchanged');
  const [handleSuggestion, setHandleSuggestion] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when team changes
  useEffect(() => {
    setEditName(team.name);
    setEditHandle(team.handle);
    setHandleStatus('unchanged');
    setHandleSuggestion(null);
  }, [team.name, team.handle]);

  // Debounced handle availability check
  const checkHandle = useCallback(
    async (h: string) => {
      if (h === team.handle) {
        setHandleStatus('unchanged');
        setHandleSuggestion(null);
        return;
      }

      if (!h || h.length < 3) {
        setHandleStatus(h.length > 0 ? 'invalid' : 'idle');
        setHandleSuggestion(null);
        return;
      }

      // Validate format
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/.test(h)) {
        setHandleStatus('invalid');
        setHandleSuggestion(null);
        return;
      }

      setHandleStatus('checking');
      try {
        const result = await checkHandleAvailability(h, teamId);
        setHandleStatus(result.available ? 'available' : 'taken');
        setHandleSuggestion(result.suggestion || null);
      } catch {
        setHandleStatus('idle');
      }
    },
    [team.handle, teamId]
  );

  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (!editHandle) {
      setHandleStatus('idle');
      setHandleSuggestion(null);
      return;
    }

    checkTimeoutRef.current = setTimeout(() => {
      checkHandle(editHandle);
    }, 300);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [editHandle, checkHandle]);

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => updateTeam(teamId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      addToast({ type: 'success', title: 'Team name updated' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Update failed', message: error.message });
    },
  });

  const updateHandleMutation = useMutation({
    mutationFn: (handle: string) => updateTeam(teamId, { handle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      addToast({ type: 'success', title: 'Team handle updated' });
      setHandleStatus('unchanged');
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Update failed', message: error.message });
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: () => createTeamInvite(teamId),
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      addToast({ type: 'success', title: 'Invite created' });
      // Auto-copy the new invite code
      navigator.clipboard.writeText(invite.invite_code);
      setCopiedId(invite.invite_id);
      setTimeout(() => setCopiedId(null), 2000);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to create invite', message: error.message });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => revokeTeamInvite(teamId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      addToast({ type: 'success', title: 'Invite revoked' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to revoke invite', message: error.message });
    },
  });

  const handleSaveName = () => {
    if (editName.trim() && editName.trim() !== team.name) {
      updateNameMutation.mutate(editName.trim());
    }
  };

  const handleSaveHandle = () => {
    if (editHandle.trim() && editHandle.trim() !== team.handle && handleStatus === 'available') {
      updateHandleMutation.mutate(editHandle.trim());
    }
  };

  const handleHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setEditHandle(value);
  };

  const useSuggestion = () => {
    if (handleSuggestion) {
      setEditHandle(handleSuggestion);
    }
  };

  const handleCopyInvite = (invite: TeamInvite) => {
    navigator.clipboard.writeText(invite.invite_code);
    setCopiedId(invite.invite_id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast({ type: 'success', title: 'Copied to clipboard' });
  };

  return (
    <>
      {/* Team Name */}
      <SidekickSection title="Display Name">
        <div className={styles.settingsSection}>
          <div className={styles.settingsField}>
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Team name"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveName}
            disabled={
              !editName.trim() || editName.trim() === team.name || updateNameMutation.isPending
            }
          >
            {updateNameMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={14} />
                Save
              </>
            )}
          </Button>
        </div>
      </SidekickSection>

      {/* Team Handle */}
      <SidekickSection title="Handle">
        <div className={styles.settingsSection}>
          <div className={styles.settingsField}>
            <div className={styles.handleInputWrapper}>
              <span className={styles.handlePrefix}>
                <AtSign size={14} />
              </span>
              <Input
                type="text"
                value={editHandle}
                onChange={handleHandleChange}
                placeholder="team-handle"
                className={styles.handleInput}
                maxLength={30}
              />
              <span className={styles.handleStatus}>
                {handleStatus === 'checking' && (
                  <Loader2 size={14} className={styles.statusChecking} />
                )}
                {handleStatus === 'available' && (
                  <Check size={14} className={styles.statusAvailable} />
                )}
                {handleStatus === 'taken' && <X size={14} className={styles.statusTaken} />}
                {handleStatus === 'invalid' && <X size={14} className={styles.statusInvalid} />}
              </span>
            </div>

            {handleStatus === 'taken' && handleSuggestion && (
              <div className={styles.handleHint}>
                Handle taken. Try{' '}
                <button type="button" className={styles.suggestionLink} onClick={useSuggestion}>
                  @{handleSuggestion}
                </button>
              </div>
            )}

            {handleStatus === 'invalid' && editHandle.length > 0 && (
              <div className={styles.handleHint}>
                {editHandle.length < 3
                  ? 'Handle must be at least 3 characters'
                  : 'Only lowercase letters, numbers, and hyphens'}
              </div>
            )}

            {handleStatus === 'available' && (
              <div className={styles.handleAvailable}>@{editHandle} is available</div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveHandle}
            disabled={handleStatus !== 'available' || updateHandleMutation.isPending}
          >
            {updateHandleMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={14} />
                Save
              </>
            )}
          </Button>
        </div>
      </SidekickSection>

      {/* Invites */}
      <SidekickSection title="Invite Codes">
        <div className={styles.inviteSection}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => createInviteMutation.mutate()}
            disabled={createInviteMutation.isPending}
          >
            {createInviteMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Generate Invite
          </Button>
          {pendingInvites.length > 0 ? (
            pendingInvites.map((invite) => (
              <div key={invite.invite_id} className={styles.inviteItem}>
                <code className={styles.inviteCode}>{invite.invite_code}</code>
                <span className={styles.inviteExpiry}>
                  Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => handleCopyInvite(invite)}
                  title="Copy code"
                >
                  {copiedId === invite.invite_id ? <Check size={14} /> : <Copy size={14} />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => revokeInviteMutation.mutate(invite.invite_id)}
                  title="Revoke invite"
                  className={styles.dangerButton}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          ) : (
            <p className={styles.emptyMessage}>No pending invites yet.</p>
          )}
        </div>
      </SidekickSection>

      {/* Danger Zone */}
      <SidekickSection title="Danger Zone">
        <div className={styles.dangerZone}>
          <div className={styles.dangerTitle}>Delete Team</div>
          <p className={styles.dangerText}>
            Once deleted, this team and all its data will be permanently removed.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDeleteTeam}
            className={styles.dangerButton}
          >
            <Trash2 size={14} />
            Delete Team
          </Button>
        </div>
      </SidekickSection>
    </>
  );
}
