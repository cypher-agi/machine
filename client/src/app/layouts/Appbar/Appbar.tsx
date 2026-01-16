import { NavLink } from 'react-router-dom';
import { Server, Cloud, GitBranch, Package, Key, Plug, Users, FolderGit2, Bot } from 'lucide-react';
import { NavItem, NavList } from '@/shared/ui';
import styles from './Appbar.module.css';

interface NavItemData {
  to: string;
  icon: typeof Server;
  label: string;
}

const navItems: NavItemData[] = [
  { to: '/agents', icon: Bot, label: 'Agents' },
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
    <NavList className={styles.appbar}>
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to} className={styles.navLinkWrapper}>
          {({ isActive }) => (
            <NavItem icon={<item.icon size={16} />} label={item.label} active={isActive} />
          )}
        </NavLink>
      ))}
    </NavList>
  );
}
