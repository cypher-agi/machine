import { NavLink } from 'react-router-dom';
import { 
  Server, 
  Cloud, 
  GitBranch, 
  Package, 
  Settings,
  Terminal,
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
    <aside className="w-64 bg-black border-r border-machine-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-machine-border">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-green flex items-center justify-center">
          <Terminal className="w-5 h-5 text-machine-bg" />
        </div>
        <div>
          <h1 className="font-mono font-bold text-lg text-text-primary tracking-tight">
            Machine
          </h1>
          <p className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">
            Infrastructure
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                'hover:bg-machine-elevated group',
                isActive
                  ? 'bg-machine-elevated text-neon-cyan border border-neon-cyan/20'
                  : 'text-text-secondary border border-transparent'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={clsx(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-neon-cyan' : 'text-text-tertiary group-hover:text-text-secondary'
                  )}
                />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-neon-cyan" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-machine-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center">
            <span className="text-xs font-bold text-machine-bg">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">Admin</p>
            <p className="text-xs text-text-tertiary truncate">admin@machine.io</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

