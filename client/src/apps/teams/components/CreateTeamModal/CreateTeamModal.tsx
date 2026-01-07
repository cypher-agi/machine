import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X, AtSign } from 'lucide-react';
import { createTeam, checkHandleAvailability } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input } from '@/shared/ui';
import styles from './CreateTeamModal.module.css';

export interface CreateTeamModalProps {
  onClose: () => void;
}

type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function CreateTeamModal({ onClose }: CreateTeamModalProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<HandleStatus>('idle');
  const [handleSuggestion, setHandleSuggestion] = useState<string | null>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate handle from name when name changes (only if handle hasn't been manually edited)
  const [handleManuallyEdited, setHandleManuallyEdited] = useState(false);

  useEffect(() => {
    if (!handleManuallyEdited && name) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      setHandle(generated);
    }
  }, [name, handleManuallyEdited]);

  // Debounced handle availability check
  const checkHandle = useCallback(async (h: string) => {
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
      const result = await checkHandleAvailability(h);
      setHandleStatus(result.available ? 'available' : 'taken');
      setHandleSuggestion(result.suggestion || null);
    } catch {
      setHandleStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (!handle) {
      setHandleStatus('idle');
      setHandleSuggestion(null);
      return;
    }

    checkTimeoutRef.current = setTimeout(() => {
      checkHandle(handle);
    }, 300);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [handle, checkHandle]);

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      addToast({ type: 'success', title: 'Team created', message: `"${team.name}" is ready` });
      setSidekickSelection({ type: 'team', id: team.team_id });
      onClose();
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to create team', message: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast({ type: 'error', title: 'Validation error', message: 'Team name is required' });
      return;
    }

    if (!handle.trim() || handleStatus !== 'available') {
      addToast({
        type: 'error',
        title: 'Validation error',
        message: 'A valid, available handle is required',
      });
      return;
    }

    createMutation.mutate({ name: name.trim(), handle: handle.trim() });
  };

  const handleHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setHandle(value);
    setHandleManuallyEdited(true);
  };

  const useSuggestion = () => {
    if (handleSuggestion) {
      setHandle(handleSuggestion);
      setHandleManuallyEdited(true);
    }
  };

  const canSubmit = name.trim().length > 0 && handleStatus === 'available';

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Create Team"
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
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check size={14} />
                Create
              </>
            )}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Display Name</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Engineering Team"
            autoFocus
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Handle
            <span className={styles.labelHint}>Unique identifier</span>
          </label>
          <div className={styles.handleInputWrapper}>
            <span className={styles.handlePrefix}>
              <AtSign size={14} />
            </span>
            <Input
              type="text"
              value={handle}
              onChange={handleHandleChange}
              placeholder="engineering"
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

          {handleStatus === 'invalid' && handle.length > 0 && (
            <div className={styles.handleHint}>
              {handle.length < 3
                ? 'Handle must be at least 3 characters'
                : 'Only lowercase letters, numbers, and hyphens'}
            </div>
          )}

          {handleStatus === 'available' && (
            <div className={styles.handleAvailable}>@{handle} is available</div>
          )}
        </div>
      </form>
    </Modal>
  );
}
