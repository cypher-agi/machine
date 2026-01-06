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
    <aside className="w-52 bg-cursor-bg border-r border-cursor-border flex flex-col">
      {/* Logo - minimal */}
      <div className="h-12 flex items-center gap-2 px-4 border-b border-cursor-border">
        <div className="w-6 h-6 rounded bg-cursor-elevated border border-cursor-border flex items-center justify-center">
          <Server className="w-3.5 h-3.5 text-text-secondary" />
        </div>
        <span className="font-medium text-sm text-text-primary">
          Machine
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded text-sm',
                'transition-colors duration-75',
                isActive
                  ? 'bg-cursor-elevated text-text-primary'
                  : 'text-text-secondary hover:bg-cursor-surface hover:text-text-primary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={clsx(
                    'w-4 h-4',
                    isActive ? 'text-text-primary' : 'text-text-muted'
                  )}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer - minimal */}
      <div className="px-3 py-3 border-t border-cursor-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-cursor-elevated border border-cursor-border flex items-center justify-center">
            <span className="text-[10px] font-medium text-text-muted">A</span>
          </div>
          <span className="text-xs text-text-muted truncate">admin</span>
        </div>
      </div>
    </aside>
  );
}
