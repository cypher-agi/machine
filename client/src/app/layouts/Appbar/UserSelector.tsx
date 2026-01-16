import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '@/shared';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import styles from './UserSelector.module.css';

export function UserSelector() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { openProfileModal } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.userSelector} ref={menuRef}>
      <button
        className={styles.userButton}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <Avatar
          name={user?.display_name || 'User'}
          src={user?.profile_picture_url}
          size="md"
          className={styles.avatar}
        />
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user?.display_name || 'User'}</span>
          <span className={styles.userRole}>{user?.role || 'user'}</span>
        </div>
        <ChevronUp size={14} className={clsx(styles.chevron, menuOpen && styles.chevronOpen)} />
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHeader}>
            <span className={styles.menuEmail}>{user?.email}</span>
          </div>

          <div className={styles.menuItems}>
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
    </div>
  );
}
