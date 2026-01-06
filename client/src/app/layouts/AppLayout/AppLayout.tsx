import { Outlet } from 'react-router-dom';
import { Topbar } from '../Topbar';
import { Appbar } from '../Appbar';
import { useAppStore } from '@/store/appStore';
import { Sidekick } from '@/features/sidekick';
import { Toasts } from '@/shared/components';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { sidekickSelection, setSidekickSelection, toasts, removeToast } = useAppStore();

  const handleClose = () => {
    setSidekickSelection(null);
  };

  return (
    <div className={styles.layout}>
      {/* Topbar - Always visible */}
      <Topbar />

      {/* Main Area with Appbar */}
      <div className={styles.mainWrapper}>
        {/* Left Appbar */}
        <Appbar />

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

      {/* Toast notifications */}
      <Toasts toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

