import { Outlet } from 'react-router-dom';
import { GlobalHeader } from './GlobalHeader';
import { Sidebar } from './Sidebar';
import { RightMenu } from './RightMenu';
import { useAppStore } from '@/store/appStore';
import { Sidekick } from '@/shared/components/Sidekick';
import { Toasts } from '@/shared/components/Toasts';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();

  const handleClose = () => {
    setSidekickSelection(null);
  };

  return (
    <div className={styles.layout}>
      {/* Global Header - Always visible */}
      <GlobalHeader />

      {/* Main Area with Sidebar */}
      <div className={styles.mainWrapper}>
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className={styles.main}>
          {/* Primary Content Area */}
          <div className={styles.content}>
            <Outlet />
          </div>

          {/* Sidekick Panel - handles its own open/close animation */}
          <Sidekick
            selection={sidekickSelection}
            onClose={handleClose}
          />
        </main>
      </div>

      {/* Right Menu (hamburger) */}
      <RightMenu />

      {/* Toast notifications */}
      <Toasts />
    </div>
  );
}
