import { useState } from 'react';
import { Save } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { Button, Input } from '@/shared/ui';
import { AvatarUpload } from '../AvatarUpload';
import styles from './ProfileTab.module.css';

export function ProfileTab() {
  const { user, updateProfile } = useAuthStore();
  const { addToast } = useAppStore();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = displayName !== user?.display_name || email !== user?.email;

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setError(null);

    try {
      await updateProfile({
        ...(displayName !== user?.display_name && { display_name: displayName }),
        ...(email !== user?.email && { email }),
      });
      addToast({ type: 'success', title: 'Profile updated' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
      addToast({ type: 'error', title: 'Failed to update profile', message });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className={styles.tab}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Profile Picture</h3>
        <p className={styles.sectionDesc}>
          Click to upload a new profile picture. Max 2MB, JPG/PNG/GIF/WebP.
        </p>
        <AvatarUpload />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Personal Information</h3>

        <div className={styles.field}>
          <label className={styles.label}>Display Name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
          <p className={styles.hint}>This is how you&apos;ll appear to other team members.</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <p className={styles.hint}>Used for login and notifications.</p>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Account Info</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>User ID</span>
            <code className={styles.infoValueMono}>{user?.user_id}</code>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Role</span>
            <span className={styles.infoValue}>{user?.role}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Member since</span>
            <span className={styles.infoValue}>{formatDate(user?.created_at)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Last login</span>
            <span className={styles.infoValue}>{formatDate(user?.last_login_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
