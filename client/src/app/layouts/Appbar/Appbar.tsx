import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Server,
  Cloud,
  GitBranch,
  Package,
  Settings,
  Key,
  LogOut,
  User,
  ChevronUp,
  Shield,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { TeamSelector } from './TeamSelector';
import styles from './Appbar.module.css';

interface NavItem {
  to: string;
  icon: typeof Server;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/machines', icon: Server, label: 'Machines' },
  { to: '/providers', icon: Cloud, label: 'Providers' },
  { to: '/keys', icon: Key, label: 'Keys' },
  { to: '/deployments', icon: GitBranch, label: 'Deployments' },
  { to: '/bootstrap', icon: Package, label: 'Bootstrap' },
];

const footerNavItems: NavItem[] = [
  { to: '/teams', icon: Users, label: 'Teams' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Appbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
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

  const initials =
    user?.display_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  return (
    <aside className={styles.appbar}>
      {/* Main Navigation */}
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={16}
                  className={clsx(styles.navIcon, isActive && styles.navIconActive)}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer Navigation (Teams, Settings) */}
      <nav className={styles.footerNav}>
        {footerNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => clsx(styles.navLink, isActive && styles.navLinkActive)}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={16}
                  className={clsx(styles.navIcon, isActive && styles.navIconActive)}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Team Selector - above user profile */}
      <TeamSelector />

      {/* User Footer */}
      <div className={styles.footer} ref={menuRef}>
        <button
          className={styles.userButton}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <div className={styles.avatar}>
            {user?.profile_picture_url ? (
              <img
                src={user.profile_picture_url}
                alt={user.display_name}
                className={styles.avatarImage}
              />
            ) : (
              <span className={styles.avatarInitials}>{initials}</span>
            )}
          </div>
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
                  navigate('/settings');
                }}
                role="menuitem"
              >
                <User size={14} />
                <span>Profile Settings</span>
              </button>

              {user?.role === 'admin' && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/settings');
                  }}
                  role="menuitem"
                >
                  <Shield size={14} />
                  <span>Admin Settings</span>
                </button>
              )}

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
    </aside>
  );
}
