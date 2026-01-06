import { useLocation } from 'react-router-dom';
import {
  X,
  Plus,
  Filter,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Play,
  Settings,
  Search,
  SortAsc,
  Clock,
  Shield,
  Zap,
  FileText,
  Key,
  Cloud,
  Server,
  GitBranch,
  Package
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import styles from './RightMenu.module.css';

interface ContextAction {
  icon: typeof Plus;
  label: string;
  description?: string;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger';
}

interface PageContext {
  title: string;
  icon: typeof Server;
  description: string;
  actions: ContextAction[];
}

const pageContexts: Record<string, PageContext> = {
  '/machines': {
    title: 'Machines',
    icon: Server,
    description: 'Manage your compute instances',
    actions: [
      { icon: Plus, label: 'Deploy Machine', description: 'Create a new machine', variant: 'primary' },
      { icon: Filter, label: 'Filters', description: 'Filter machine list' },
      { icon: SortAsc, label: 'Sort', description: 'Change sort order' },
      { icon: RefreshCw, label: 'Refresh', description: 'Reload machine data' },
    ],
  },
  '/providers': {
    title: 'Providers',
    icon: Cloud,
    description: 'Cloud provider accounts',
    actions: [
      { icon: Plus, label: 'Add Provider', description: 'Connect cloud account', variant: 'primary' },
      { icon: Shield, label: 'Verify All', description: 'Verify credentials' },
      { icon: RefreshCw, label: 'Refresh', description: 'Reload providers' },
    ],
  },
  '/keys': {
    title: 'SSH Keys',
    icon: Key,
    description: 'Manage SSH keys',
    actions: [
      { icon: Plus, label: 'Generate Key', description: 'Create new SSH key', variant: 'primary' },
      { icon: Upload, label: 'Import Key', description: 'Import existing key' },
      { icon: Download, label: 'Export Keys', description: 'Download public keys' },
      { icon: RefreshCw, label: 'Refresh', description: 'Reload key list' },
    ],
  },
  '/deployments': {
    title: 'Deployments',
    icon: GitBranch,
    description: 'Deployment history & logs',
    actions: [
      { icon: Filter, label: 'Filter', description: 'Filter deployments' },
      { icon: Clock, label: 'View Logs', description: 'Open deployment logs' },
      { icon: RefreshCw, label: 'Refresh', description: 'Reload deployments' },
      { icon: Trash2, label: 'Clear Old', description: 'Remove old deployments', variant: 'danger' },
    ],
  },
  '/bootstrap': {
    title: 'Bootstrap',
    icon: Package,
    description: 'Bootstrap profiles',
    actions: [
      { icon: Plus, label: 'New Profile', description: 'Create bootstrap profile', variant: 'primary' },
      { icon: FileText, label: 'Templates', description: 'View templates' },
      { icon: Zap, label: 'Quick Setup', description: 'Auto-configure' },
      { icon: RefreshCw, label: 'Refresh', description: 'Reload profiles' },
    ],
  },
  '/settings': {
    title: 'Settings',
    icon: Settings,
    description: 'Application configuration',
    actions: [
      { icon: Download, label: 'Export Config', description: 'Download settings' },
      { icon: Upload, label: 'Import Config', description: 'Load settings file' },
      { icon: RefreshCw, label: 'Reset Defaults', description: 'Restore defaults' },
    ],
  },
};

export function RightMenu() {
  const location = useLocation();
  const { rightMenuOpen, setRightMenuOpen, setDeployWizardOpen } = useAppStore();

  if (!rightMenuOpen) return null;

  // Get context for current page
  const basePath = '/' + (location.pathname.split('/')[1] || 'machines');
  const context = pageContexts[basePath] || pageContexts['/machines'];

  const handleAction = (action: ContextAction) => {
    // Handle specific actions
    if (action.label === 'Deploy Machine') {
      setDeployWizardOpen(true);
      setRightMenuOpen(false);
      return;
    }
    
    // Generic action handler
    if (action.onClick) {
      action.onClick();
    }
    
    setRightMenuOpen(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={styles.backdrop}
        onClick={() => setRightMenuOpen(false)}
      />

      {/* Menu Panel */}
      <aside className={styles.menu}>
        {/* Header with Context */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerIcon}>
              <context.icon size={18} />
            </div>
            <div className={styles.headerText}>
              <h2 className={styles.headerTitle}>{context.title}</h2>
              <p className={styles.headerDescription}>{context.description}</p>
            </div>
          </div>
          <button
            className={styles.closeButton}
            onClick={() => setRightMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Context Actions */}
        <div className={styles.actions}>
          <div className={styles.sectionLabel}>Actions</div>
          {context.actions.map((action, index) => (
            <button
              key={index}
              className={`${styles.actionButton} ${action.variant === 'primary' ? styles.actionPrimary : ''} ${action.variant === 'danger' ? styles.actionDanger : ''}`}
              onClick={() => handleAction(action)}
            >
              <div className={styles.actionIcon}>
                <action.icon size={16} />
              </div>
              <div className={styles.actionContent}>
                <span className={styles.actionLabel}>{action.label}</span>
                {action.description && (
                  <span className={styles.actionDescription}>{action.description}</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div className={styles.quickSearch}>
          <div className={styles.sectionLabel}>Quick Search</div>
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={`Search ${context.title.toLowerCase()}...`}
              className={styles.searchInput}
            />
          </div>
        </div>

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
