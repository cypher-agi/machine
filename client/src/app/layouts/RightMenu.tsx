import { NavLink } from 'react-router-dom';
import { Server, Cloud, Key, GitBranch, Package, Settings, X } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import styles from './RightMenu.module.css';

interface NavItem {
  to: string;
  icon: typeof Server;
  label: string;
  description: string;
}

const navItems: NavItem[] = [
  { to: '/machines', icon: Server, label: 'Machines', description: 'Manage compute instances' },
  { to: '/providers', icon: Cloud, label: 'Providers', description: 'Cloud provider accounts' },
  { to: '/keys', icon: Key, label: 'Keys', description: 'SSH keys management' },
  { to: '/deployments', icon: GitBranch, label: 'Deployments', description: 'Deployment history' },
  { to: '/bootstrap', icon: Package, label: 'Bootstrap', description: 'Bootstrap profiles' },
  { to: '/settings', icon: Settings, label: 'Settings', description: 'App configuration' },
];

export function RightMenu() {
  const { rightMenuOpen, setRightMenuOpen } = useAppStore();

  if (!rightMenuOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={styles.backdrop}
        onClick={() => setRightMenuOpen(false)}
      />

      {/* Menu Panel */}
      <aside className={styles.menu}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Navigation</h2>
          <button
            className={styles.closeButton}
            onClick={() => setRightMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setRightMenuOpen(false)}
              className={({ isActive }) =>
                clsx(styles.navLink, isActive && styles.navLinkActive)
              }
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(styles.iconWrapper, isActive && styles.iconWrapperActive)}>
                    <item.icon size={18} />
                  </div>
                  <div className={styles.navContent}>
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.navDescription}>{item.description}</span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>A</div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>admin</span>
              <span className={styles.userRole}>Administrator</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

