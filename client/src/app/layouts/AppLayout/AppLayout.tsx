import { Outlet } from 'react-router-dom';
import { Topbar } from '../Topbar';
import { Teambar } from '../Teambar';
import { Appbar, TeamSelector, UserSelector } from '../Appbar';
import { useAppStore } from '@/store/appStore';
import { Sidekick } from '@/features/sidekick';
import { ProfileSettingsModal } from '@/features/profile';
import { Toasts, Sidebar } from '@/shared';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { sidekickSelection, setSidekickSelection, toasts, removeToast } = useAppStore();

  const handleClose = () => {
    setSidekickSelection(null);
  };

  return (
    <div className={styles['layout']}>
      {/* Topbar - Always visible */}
      <Topbar />

      {/* Main Area with Sidebar and Content */}
      <div className={styles['mainWrapper']}>
        {/* Left Sidebar */}
        <Sidebar
          resizable
          minWidth={200}
          maxWidth={400}
          defaultWidth={240}
          storageKey="machina-sidebar-width"
          header={
            <div className={styles['sidebar-top']}>
              <Teambar />
              <Appbar />
            </div>
          }
          footer={
            <div className={styles['sidebar-bottom']}>
              <TeamSelector />
              <UserSelector />
            </div>
          }
        />

        {/* Main Content Area */}
        <main className={styles['main']}>
          {/* Primary Content Area */}
          <div className={styles['content']}>
            <Outlet />
          </div>

          {/* Sidekick Panel - handles its own open/close animation */}
          <Sidekick selection={sidekickSelection} onClose={handleClose} />
        </main>
      </div>

      {/* Profile Settings Modal - global access */}
      <ProfileSettingsModal />

      {/* Toast notifications */}
      <Toasts toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
