import { NavLink } from 'react-router-dom';
import {
  Server,
  Cloud,
  GitBranch,
  Package,
  Settings,
  Key
} from 'lucide-react';
import clsx from 'clsx';
import styles from './Sidebar.module.css';

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
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Server size={14} style={{ color: 'var(--color-text-secondary)' }} />
        </div>
        <span className={styles.logoText}>Machina</span>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(styles.navLink, isActive && styles.navLinkActive)
            }
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

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerIcon}>A</div>
          <span className={styles.footerText}>admin</span>
        </div>
      </div>
    </aside>
  );
}
