import { useState, useEffect } from 'react';
import { Save, Monitor, Smartphone, Globe, Trash2, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { Button, Input } from '@/shared/ui';
import * as authApi from '@/lib/authApi';
import type { Session } from '@machina/shared';
import styles from './AccountTab.module.css';

export function AccountTab() {
  const { changePassword } = useAuthStore();
  const { addToast } = useAppStore();

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  // Load sessions
  useEffect(() => {
    async function loadSessions() {
      try {
        const data = await authApi.getSessions();
        setSessions(data);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoadingSessions(false);
      }
    }
    loadSessions();
  }, []);

  const handlePasswordChange = async () => {
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      addToast({ type: 'success', title: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      setPasswordError(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    try {
      await authApi.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      addToast({ type: 'success', title: 'Session revoked' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke session';
      addToast({ type: 'error', title: 'Failed to revoke session', message });
    } finally {
      setRevokingSession(null);
    }
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return Globe;
    if (/mobile|android|iphone|ipad/i.test(userAgent)) return Smartphone;
    return Monitor;
  };

  const getDeviceName = (userAgent?: string) => {
    if (!userAgent) return 'Unknown device';
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    return 'Browser';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={styles.tab}>
      {/* Password Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Change Password</h3>
        <p className={styles.sectionDesc}>
          Update your password. You&apos;ll need to enter your current password.
        </p>

        <div className={styles.passwordForm}>
          <div className={styles.field}>
            <label className={styles.label}>Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {passwordError && <p className={styles.error}>{passwordError}</p>}

          <Button
            variant="primary"
            size="sm"
            onClick={handlePasswordChange}
            disabled={!currentPassword || !newPassword || !confirmPassword || savingPassword}
          >
            <Save size={14} />
            {savingPassword ? 'Changing...' : 'Change Password'}
          </Button>
        </div>
      </div>

      {/* Sessions Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Active Sessions</h3>
        <p className={styles.sectionDesc}>
          Manage your active sessions. Revoking a session will sign out that device.
        </p>

        {loadingSessions ? (
          <div className={styles.loadingState}>
            <Loader2 size={16} className={styles.spinner} />
            <span>Loading sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <p className={styles.emptyState}>No active sessions found.</p>
        ) : (
          <div className={styles.sessionList}>
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.user_agent);
              const isCurrent = session.is_current;
              const isRevoking = revokingSession === session.session_id;

              return (
                <div
                  key={session.session_id}
                  className={clsx(styles.session, isCurrent && styles.sessionCurrent)}
                >
                  <DeviceIcon size={16} className={styles.sessionIcon} />
                  <div className={styles.sessionInfo}>
                    <div className={styles.sessionName}>
                      {getDeviceName(session.user_agent)}
                      {isCurrent && <span className={styles.currentBadge}>Current</span>}
                    </div>
                    <div className={styles.sessionMeta}>
                      {session.ip_address && <span>{session.ip_address}</span>}
                      <span>Active {formatDate(session.last_activity_at)}</span>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.session_id)}
                      disabled={isRevoking}
                      className={styles.revokeButton}
                    >
                      {isRevoking ? (
                        <Loader2 size={14} className={styles.spinner} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
