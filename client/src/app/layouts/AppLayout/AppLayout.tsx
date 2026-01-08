import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { Topbar } from '../Topbar';
import { Teambar } from '../Teambar';
import { Appbar, TeamSelector, UserSelector } from '../Appbar';
import { useAppStore } from '@/store/appStore';
import { Sidekick } from '@/features/sidekick';
import { ProfileSettingsModal } from '@/features/profile';
import { Toasts } from '@/shared/components';
import styles from './AppLayout.module.css';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_WIDTH_KEY = 'sidebar-width';

function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      if (width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
        return width;
      }
    }
  } catch {
    // localStorage might not be available
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

function saveWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch {
    // localStorage might not be available
  }
}

export function AppLayout() {
  const { sidekickSelection, setSidekickSelection, toasts, removeToast } = useAppStore();
  const [sidebarWidth, setSidebarWidth] = useState(getSavedWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleClose = () => {
    setSidekickSelection(null);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;

      const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
      const newWidth = e.clientX - sidebarLeft;
      const clampedWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      saveWidth(sidebarWidth);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, sidebarWidth]);

  return (
    <div className={styles.layout}>
      {/* Topbar - Always visible */}
      <Topbar />

      {/* Main Area with Sidebar and Content */}
      <div className={styles.mainWrapper}>
        {/* Left Sidebar */}
        <aside
          ref={sidebarRef}
          className={clsx(styles.sidebar, isResizing && styles.sidebarResizing)}
          style={{ width: sidebarWidth }}
        >
          {/* Resize Handle */}
          <div className={styles.resizeHandle} onMouseDown={handleMouseDown}>
            <div className={styles.resizeHandleLine} />
          </div>

          {/* Top section: Teambar + Navigation side by side */}
          <div className={styles.sidebarTop}>
            <Teambar />
            <Appbar />
          </div>

          {/* Bottom section: Selectors spanning full width */}
          <div className={styles.sidebarBottom}>
            <TeamSelector />
            <UserSelector />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={styles.main}>
          {/* Primary Content Area */}
          <div className={styles.content}>
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
