# Profile & Settings Modal Specification

## Overview

The **Profile & Settings Modal** provides a unified, globally-accessible modal for managing user profile information and application preferences. Unlike team-scoped features, this modal operates outside of team context and is accessible from anywhere in the application via the user menu.

**Key Design Principles:**

1. **Global Context** — Profile settings are user-level, not team-scoped
2. **Unified Entry Point** — Single modal for profile + app settings (replaces /settings route)
3. **Live State Updates** — Changes propagate immediately through Zustand state
4. **Optimistic UI** — Immediate feedback with error rollback

---

## Table of Contents

1. [Architecture](#architecture)
2. [File Structure](#file-structure)
3. [Data Types](#data-types)
4. [State Management](#state-management)
5. [Components](#components)
6. [API Integration](#api-integration)
7. [Implementation Checklist](#implementation-checklist)

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Profile Settings Modal                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         UserSelector (Appbar)                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Click → Opens ProfileSettingsModal                             │  │ │
│  │  │  - Profile option (new)                                         │  │ │
│  │  │  - Settings option (refactored)                                 │  │ │
│  │  │  - Sign Out                                                     │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      ProfileSettingsModal                              │ │
│  │  ┌──────────────┬─────────────────────────────────────────────────┐   │ │
│  │  │  Tab Nav     │  Content Area                                   │   │ │
│  │  │              │                                                 │   │ │
│  │  │  ○ Profile   │  [Profile Tab]                                  │   │ │
│  │  │    - Avatar  │  - Avatar upload/remove                         │   │ │
│  │  │    - Name    │  - Display name field                           │   │ │
│  │  │    - Email   │  - Email field                                  │   │ │
│  │  │              │  - Account creation date                        │   │ │
│  │  │  ○ Account   │                                                 │   │ │
│  │  │    - Pass    │  [Account Tab]                                  │   │ │
│  │  │    - Sessions│  - Change password form                         │   │ │
│  │  │              │  - Active sessions list                         │   │ │
│  │  │  ○ Settings  │  - Revoke session buttons                       │   │ │
│  │  │    - Theme   │                                                 │   │ │
│  │  │    - Time    │  [Settings Tab]                                 │   │ │
│  │  │    - Notifs  │  - Theme (dark/light)                           │   │ │
│  │  │              │  - Timezone preference                          │   │ │
│  │  │              │  - Notification preferences                     │   │ │
│  │  │              │  - Refresh interval                             │   │ │
│  │  └──────────────┴─────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         authStore (Zustand)                            │ │
│  │  - user: User | null                                                   │ │
│  │  - updateProfile(data) → Updates user → UI re-renders                  │ │
│  │  - uploadAvatar(file) → Updates user.profile_picture_url               │ │
│  │  - deleteAvatar() → Removes profile_picture_url                        │ │
│  │  - changePassword(current, new)                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modal vs Page Decision

| Approach | Pros | Cons |
|----------|------|------|
| **Modal (chosen)** | Accessible from anywhere, no navigation required, maintains context | Limited space for complex forms |
| **Page route** | More space, familiar pattern | Requires navigation, loses context |

The modal approach is preferred because:
- Profile settings are quick, focused operations
- Users expect immediate access without leaving their current view
- Changes should feel instant and connected to the user menu
- Modal can be large (lg/xl size) to accommodate content

---

## File Structure

```
client/src/features/profile/
├── index.ts                           # Barrel export
├── ProfileSettingsModal.tsx           # Main modal component
├── ProfileSettingsModal.module.css    # Modal styles
└── components/
    ├── index.ts                       # Components barrel
    ├── ProfileTab/
    │   ├── ProfileTab.tsx             # Profile editing tab
    │   ├── ProfileTab.module.css
    │   └── index.ts
    ├── AccountTab/
    │   ├── AccountTab.tsx             # Password & sessions tab
    │   ├── AccountTab.module.css
    │   └── index.ts
    ├── SettingsTab/
    │   ├── SettingsTab.tsx            # App preferences tab
    │   ├── SettingsTab.module.css
    │   └── index.ts
    └── AvatarUpload/
        ├── AvatarUpload.tsx           # Reusable avatar upload component
        ├── AvatarUpload.module.css
        └── index.ts
```

---

## Data Types

### Existing Types (from `@machina/shared`)

```typescript
// Already defined in shared/src/types/user.ts
export interface User {
  user_id: string;
  email: string;
  display_name: string;
  profile_picture_url?: string | undefined;
  role: UserRole;
  created_at: string;
  updated_at: string;
  last_login_at?: string | undefined;
}

export interface Session {
  session_id: string;
  user_id: string;
  ip_address?: string | undefined;
  user_agent?: string | undefined;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  is_current?: boolean | undefined;
}

export interface UpdateProfileRequest {
  display_name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}
```

### New Types (client-side only)

```typescript
// client/src/features/profile/types.ts

export type ProfileSettingsTab = 'profile' | 'account' | 'settings';

export interface ProfileFormData {
  display_name: string;
  email: string;
}

export interface PasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

// User preferences (stored in localStorage via Zustand persist)
export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  timezone: 'local' | 'utc';
  refreshInterval: number; // seconds
  notifications: {
    deployments: {
      started: boolean;
      succeeded: boolean;
      failed: boolean;
    };
    machines: {
      unreachable: boolean;
      serviceFailed: boolean;
      driftDetected: boolean;
    };
  };
}
```

---

## State Management

### authStore Extensions

The existing `authStore` already has the necessary actions. No changes required:

```typescript
// Existing in client/src/store/authStore.ts
interface AuthState {
  user: User | null;
  
  // Profile actions (already implemented)
  updateProfile: (data: { display_name?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

### New: preferencesStore

```typescript
// client/src/store/preferencesStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences } from '@/features/profile/types';

interface PreferencesState extends UserPreferences {
  // Actions
  setTheme: (theme: UserPreferences['theme']) => void;
  setTimezone: (timezone: UserPreferences['timezone']) => void;
  setRefreshInterval: (interval: number) => void;
  setNotificationPreference: (
    category: 'deployments' | 'machines',
    key: string,
    enabled: boolean
  ) => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  timezone: 'local',
  refreshInterval: 10,
  notifications: {
    deployments: { started: true, succeeded: true, failed: true },
    machines: { unreachable: true, serviceFailed: true, driftDetected: true },
  },
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,

      setTheme: (theme) => set({ theme }),
      setTimezone: (timezone) => set({ timezone }),
      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
      setNotificationPreference: (category, key, enabled) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [category]: {
              ...state.notifications[category],
              [key]: enabled,
            },
          },
        })),
    }),
    {
      name: 'user-preferences',
    }
  )
);
```

### appStore Extension

```typescript
// Add to client/src/store/appStore.ts
interface AppState {
  // ... existing state ...
  
  // Profile modal state
  profileModalOpen: boolean;
  profileModalTab: ProfileSettingsTab;
  
  // Actions
  openProfileModal: (tab?: ProfileSettingsTab) => void;
  closeProfileModal: () => void;
  setProfileModalTab: (tab: ProfileSettingsTab) => void;
}
```

---

## Components

### ProfileSettingsModal

Main modal component with tab navigation.

```tsx
// client/src/features/profile/ProfileSettingsModal.tsx
import { useState } from 'react';
import { User, Shield, Settings } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '@/shared/ui';
import { useAppStore } from '@/store/appStore';
import { ProfileTab, AccountTab, SettingsTab } from './components';
import type { ProfileSettingsTab } from './types';
import styles from './ProfileSettingsModal.module.css';

const tabs: { id: ProfileSettingsTab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function ProfileSettingsModal() {
  const { profileModalOpen, profileModalTab, closeProfileModal, setProfileModalTab } =
    useAppStore();

  return (
    <Modal
      isOpen={profileModalOpen}
      onClose={closeProfileModal}
      title="Settings"
      size="lg"
      noPadding
    >
      <div className={styles.layout}>
        {/* Tab Navigation */}
        <nav className={styles.nav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setProfileModalTab(tab.id)}
              className={clsx(
                styles.navButton,
                profileModalTab === tab.id && styles.navButtonActive
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {profileModalTab === 'profile' && <ProfileTab />}
          {profileModalTab === 'account' && <AccountTab />}
          {profileModalTab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </Modal>
  );
}
```

### ProfileTab

Profile editing with avatar upload, display name, and email.

```tsx
// client/src/features/profile/components/ProfileTab/ProfileTab.tsx
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
          <p className={styles.hint}>This is how you'll appear to other team members.</p>
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
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Account Info</h3>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>User ID</span>
          <code className={styles.infoValue}>{user?.user_id}</code>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Role</span>
          <span className={styles.infoValue}>{user?.role}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Member since</span>
          <span className={styles.infoValue}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
```

### AvatarUpload

Reusable avatar upload component with preview and delete.

```tsx
// client/src/features/profile/components/AvatarUpload/AvatarUpload.tsx
import { useState, useRef } from 'react';
import { Camera, Trash2, Upload, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/shared/ui';
import styles from './AvatarUpload.module.css';

export function AvatarUpload() {
  const { user, uploadAvatar, deleteAvatar } = useAuthStore();
  const { addToast } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials = user?.display_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large', message: 'Maximum size is 2MB' });
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      addToast({ type: 'error', title: 'Invalid file type', message: 'Use JPG, PNG, GIF, or WebP' });
      return;
    }

    setUploading(true);
    try {
      await uploadAvatar(file);
      addToast({ type: 'success', title: 'Profile picture updated' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload';
      addToast({ type: 'error', title: 'Upload failed', message });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAvatar();
      addToast({ type: 'success', title: 'Profile picture removed' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove';
      addToast({ type: 'error', title: 'Removal failed', message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div
        className={clsx(styles.avatar, (uploading || deleting) && styles.avatarLoading)}
        onClick={() => !uploading && !deleting && fileInputRef.current?.click()}
      >
        {uploading || deleting ? (
          <Loader2 size={24} className={styles.spinner} />
        ) : user?.profile_picture_url ? (
          <>
            <img
              src={user.profile_picture_url}
              alt={user.display_name}
              className={styles.avatarImage}
            />
            <div className={styles.overlay}>
              <Camera size={20} />
            </div>
          </>
        ) : (
          <>
            <span className={styles.initials}>{initials}</span>
            <div className={styles.overlay}>
              <Camera size={20} />
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className={styles.fileInput}
      />

      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
        >
          <Upload size={14} />
          Upload
        </Button>
        {user?.profile_picture_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={uploading || deleting}
            className={styles.deleteButton}
          >
            <Trash2 size={14} />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
```

### AccountTab

Password change and session management.

```tsx
// client/src/features/profile/components/AccountTab/AccountTab.tsx
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
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    return 'Browser';
  };

  return (
    <div className={styles.tab}>
      {/* Password Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Change Password</h3>
        <p className={styles.sectionDesc}>
          Update your password. You'll need to enter your current password.
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
                      <span>
                        Active {new Date(session.last_activity_at).toLocaleDateString()}
                      </span>
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
```

### SettingsTab

Application preferences (migrated from /settings route).

```tsx
// client/src/features/profile/components/SettingsTab/SettingsTab.tsx
import { Moon, Sun, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useAppStore } from '@/store/appStore';
import { Select, Toggle } from '@/shared/ui';
import styles from './SettingsTab.module.css';

export function SettingsTab() {
  const preferences = usePreferencesStore();
  const { addToast } = useAppStore();

  const handleThemeChange = (theme: 'dark' | 'light' | 'system') => {
    preferences.setTheme(theme);
    addToast({ type: 'success', title: `Theme set to ${theme}` });
  };

  return (
    <div className={styles.tab}>
      {/* Appearance */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Appearance</h3>

        <div className={styles.formRow}>
          <div>
            <p className={styles.formLabel}>Theme</p>
            <p className={styles.formLabelDesc}>Choose your preferred color scheme</p>
          </div>
          <div className={styles.themeToggle}>
            <button
              className={clsx(
                styles.themeButton,
                preferences.theme === 'dark' && styles.themeButtonActive
              )}
              onClick={() => handleThemeChange('dark')}
              title="Dark"
            >
              <Moon size={14} />
            </button>
            <button
              className={clsx(
                styles.themeButton,
                preferences.theme === 'light' && styles.themeButtonActive
              )}
              onClick={() => handleThemeChange('light')}
              title="Light"
            >
              <Sun size={14} />
            </button>
            <button
              className={clsx(
                styles.themeButton,
                preferences.theme === 'system' && styles.themeButtonActive
              )}
              onClick={() => handleThemeChange('system')}
              title="System"
            >
              <Monitor size={14} />
            </button>
          </div>
        </div>

        <div className={styles.formRow}>
          <div>
            <p className={styles.formLabel}>Refresh Interval</p>
            <p className={styles.formLabelDesc}>How often to poll for updates</p>
          </div>
          <Select
            size="sm"
            value={preferences.refreshInterval.toString()}
            onChange={(e) => preferences.setRefreshInterval(Number(e.target.value))}
            className={styles.selectNarrow}
          >
            <option value="5">5 seconds</option>
            <option value="10">10 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
          </Select>
        </div>
      </div>

      {/* Date & Time */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Date & Time</h3>

        <div className={styles.formRow}>
          <div>
            <p className={styles.formLabel}>Timezone</p>
            <p className={styles.formLabelDesc}>How to display timestamps</p>
          </div>
          <Select
            size="sm"
            value={preferences.timezone}
            onChange={(e) => preferences.setTimezone(e.target.value as 'local' | 'utc')}
            className={styles.selectMedium}
          >
            <option value="local">Local timezone</option>
            <option value="utc">UTC</option>
          </Select>
        </div>
      </div>

      {/* Notifications */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Deployment Notifications</h3>

        {['started', 'succeeded', 'failed'].map((key) => (
          <div key={key} className={styles.formRow}>
            <span className={styles.toggleLabel}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
            <Toggle
              checked={preferences.notifications.deployments[key as keyof typeof preferences.notifications.deployments]}
              onChange={(checked) =>
                preferences.setNotificationPreference('deployments', key, checked)
              }
            />
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Machine Alerts</h3>

        {[
          { key: 'unreachable', label: 'Unreachable' },
          { key: 'serviceFailed', label: 'Service failed' },
          { key: 'driftDetected', label: 'Drift detected' },
        ].map(({ key, label }) => (
          <div key={key} className={styles.formRow}>
            <span className={styles.toggleLabel}>{label}</span>
            <Toggle
              checked={preferences.notifications.machines[key as keyof typeof preferences.notifications.machines]}
              onChange={(checked) =>
                preferences.setNotificationPreference('machines', key, checked)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## API Integration

### Existing Endpoints (No Changes Required)

All required endpoints already exist in `server/src/routes/auth.ts`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/me` | Get current user |
| `PUT` | `/api/auth/me` | Update profile (display_name, email, password) |
| `POST` | `/api/auth/me/avatar` | Upload profile picture |
| `DELETE` | `/api/auth/me/avatar` | Remove profile picture |
| `GET` | `/api/auth/sessions` | List active sessions |
| `DELETE` | `/api/auth/sessions/:id` | Revoke a session |

### Existing Client API (No Changes Required)

All required client functions exist in `client/src/lib/authApi.ts`:

```typescript
// Already implemented
export async function getMe(): Promise<User>;
export async function updateMe(data: UpdateProfileRequest): Promise<User>;
export async function uploadAvatar(file: File): Promise<User>;
export async function deleteAvatar(): Promise<User>;
export async function getSessions(): Promise<Session[]>;
export async function revokeSession(sessionId: string): Promise<void>;
```

---

## UI Integration

### UserSelector Updates

Update the user menu to open the profile modal instead of navigating to /settings:

```tsx
// client/src/app/layouts/Appbar/UserSelector.tsx (modifications)
import { useAppStore } from '@/store/appStore';

export function UserSelector() {
  const { openProfileModal } = useAppStore();
  // ... existing code ...

  return (
    // ... existing button ...
    {menuOpen && (
      <div className={styles.menu} role="menu">
        <div className={styles.menuHeader}>
          <span className={styles.menuEmail}>{user?.email}</span>
        </div>

        <div className={styles.menuItems}>
          {/* NEW: Profile option */}
          <button
            className={styles.menuItem}
            onClick={() => {
              setMenuOpen(false);
              openProfileModal('profile');
            }}
            role="menuitem"
          >
            <User size={14} />
            <span>Profile</span>
          </button>

          {/* UPDATED: Settings opens modal instead of navigating */}
          <button
            className={styles.menuItem}
            onClick={() => {
              setMenuOpen(false);
              openProfileModal('settings');
            }}
            role="menuitem"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>

          <div className={styles.menuDivider} />

          <button
            className={clsx(styles.menuItem, styles.menuItemDanger)}
            onClick={handleLogout}
            role="menuitem"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    )}
  );
}
```

### AppLayout Integration

Add the modal to the app layout:

```tsx
// client/src/app/layouts/AppLayout/AppLayout.tsx (modifications)
import { ProfileSettingsModal } from '@/features/profile';

export function AppLayout() {
  // ... existing code ...

  return (
    <div className={styles.layout}>
      {/* ... existing layout ... */}

      {/* Profile Settings Modal - global access */}
      <ProfileSettingsModal />

      {/* Toast notifications */}
      <Toasts toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
```

---

## Migration Notes

### Deprecating /settings Route

After implementing the profile modal:

1. **Remove** the `/settings` route from `App.tsx`
2. **Delete** the `client/src/apps/settings/` directory
3. **Update** any remaining links to `/settings` to use `openProfileModal('settings')`

The settings content is now consolidated into the modal's Settings tab, providing a more cohesive user experience.

---

## Styling Guidelines

### Modal Layout CSS

```css
/* ProfileSettingsModal.module.css */
.layout {
  display: flex;
  min-height: 400px;
  max-height: 60vh;
}

.nav {
  width: 180px;
  padding: var(--space-3);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex-shrink: 0;
}

.navButton {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.navButton:hover {
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.navButtonActive {
  background: var(--color-elevated);
  color: var(--color-accent);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}
```

### Avatar Upload CSS

```css
/* AvatarUpload.module.css */
.container {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  background: var(--color-elevated);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--transition-fast);
}

.avatar:hover {
  border-color: var(--color-accent);
}

.avatar:hover .overlay {
  opacity: 1;
}

.avatarImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.initials {
  font-size: 24px;
  font-weight: var(--font-semibold);
  color: var(--color-accent);
  text-transform: uppercase;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.fileInput {
  display: none;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.deleteButton {
  color: var(--color-danger);
}

.deleteButton:hover {
  background: var(--color-danger-bg);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.avatarLoading {
  pointer-events: none;
  opacity: 0.6;
}
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `client/src/features/profile/` directory structure
- [ ] Create `types.ts` with ProfileSettingsTab and form types
- [ ] Create `preferencesStore.ts` for user preferences
- [ ] Add profile modal state to `appStore.ts`

### Phase 2: Components
- [ ] Create `ProfileSettingsModal.tsx` main component
- [ ] Create `ProfileTab.tsx` with form and info display
- [ ] Create `AvatarUpload.tsx` component
- [ ] Create `AccountTab.tsx` with password and sessions
- [ ] Create `SettingsTab.tsx` (migrate from SettingsApp)
- [ ] Create all corresponding CSS modules

### Phase 3: Integration
- [ ] Update `UserSelector.tsx` to use modal
- [ ] Add `ProfileSettingsModal` to `AppLayout.tsx`
- [ ] Export from `features/profile/index.ts`

### Phase 4: Cleanup
- [ ] Remove `/settings` route from `App.tsx`
- [ ] Delete `apps/settings/` directory
- [ ] Update any stale references to `/settings`

### Phase 5: Testing
- [ ] Test profile update flow
- [ ] Test avatar upload/delete
- [ ] Test password change
- [ ] Test session management
- [ ] Test preferences persistence
- [ ] Test state propagation to UI (avatar in UserSelector, etc.)

---

## State Propagation

When user data is updated, it automatically propagates through the app:

```
User updates profile in ProfileTab
         ↓
authStore.updateProfile() called
         ↓
API PUT /api/auth/me
         ↓
API returns updated User object
         ↓
authStore.set({ user: updatedUser })
         ↓
All components using useAuthStore() re-render:
  - UserSelector (avatar, name)
  - ProfileTab (form fields)
  - Any other component using user data
```

This is the benefit of using Zustand - no manual state synchronization needed. Components subscribe to the store and automatically update when the user object changes.

