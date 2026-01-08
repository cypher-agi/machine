import { NavLink } from 'react-router-dom';
import { Server, Cloud, GitBranch, Package, Key, Plug, Users, FolderGit2 } from 'lucide-react';
import clsx from 'clsx';
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
  { to: '/repositories', icon: FolderGit2, label: 'Repositories' },
  { to: '/deployments', icon: GitBranch, label: 'Deployments' },
  { to: '/bootstrap', icon: Package, label: 'Bootstrap' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/members', icon: Users, label: 'Members' },
];

export function Appbar() {
  return (
    <nav className={styles.appbar}>
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
  );
}
