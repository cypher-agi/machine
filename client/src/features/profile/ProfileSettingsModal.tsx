import { User, Shield, Settings } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '@/shared';
import { useAppStore } from '@/store/appStore';
import { ProfileTab } from './components/ProfileTab';
import { AccountTab } from './components/AccountTab';
import { SettingsTab } from './components/SettingsTab';
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
      animateHeight
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
