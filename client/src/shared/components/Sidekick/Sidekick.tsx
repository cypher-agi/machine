import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { X, Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppStore, SidekickSelection } from '@/store/appStore';
import { Badge, AnimatedTabs } from '@/shared/ui';
import type { Tab } from '@/shared/ui';
import styles from './Sidekick.module.css';

// Import detail views for each item type
import { MachineDetail } from './details/MachineDetail';
import { ProviderDetail } from './details/ProviderDetail';
import { KeyDetail } from './details/KeyDetail';
import { DeploymentDetail } from './details/DeploymentDetail';
import { BootstrapDetail } from './details/BootstrapDetail';

const SIDEKICK_MIN_WIDTH = 320;
const SIDEKICK_MAX_WIDTH = 600;
const SIDEKICK_DEFAULT_WIDTH = 384;
const SIDEKICK_WIDTH_KEY = 'sidekick-width';

function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(SIDEKICK_WIDTH_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      if (width >= SIDEKICK_MIN_WIDTH && width <= SIDEKICK_MAX_WIDTH) {
        return width;
      }
    }
  } catch {
    // localStorage might not be available
  }
  return SIDEKICK_DEFAULT_WIDTH;
}

function saveWidth(width: number): void {
  try {
    localStorage.setItem(SIDEKICK_WIDTH_KEY, String(width));
  } catch {
    // localStorage might not be available
  }
}

export interface SidekickProps {
  selection: SidekickSelection | null;
  onClose: () => void;
}

export function Sidekick({ selection, onClose }: SidekickProps) {
  const [savedWidth, setSavedWidth] = useState(getSavedWidth);
  const [currentWidth, setCurrentWidth] = useState(0); // Always start at 0 for animation
  const [isResizing, setIsResizing] = useState(false);
  const [displayedSelection, setDisplayedSelection] = useState<SidekickSelection | null>(null);
  const sidekickRef = useRef<HTMLDivElement>(null);
  const isOpen = !!selection;

  // Handle open/close transitions
  useEffect(() => {
    if (isOpen) {
      // Opening - set selection immediately, then animate width open after a frame
      setDisplayedSelection(selection);
      const width = getSavedWidth();
      setSavedWidth(width);
      // Use requestAnimationFrame to ensure width starts at 0 before animating
      requestAnimationFrame(() => {
        setCurrentWidth(width);
      });
    } else {
      // Closing - animate width to 0, then clear selection
      setCurrentWidth(0);
      const timer = setTimeout(() => {
        setDisplayedSelection(null);
      }, 200); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, selection]);

  // Handle selection changes while open
  useEffect(() => {
    if (isOpen && selection) {
      setDisplayedSelection(selection);
    }
  }, [isOpen, selection]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidekickRef.current) return;
      
      const containerRight = window.innerWidth;
      const newWidth = containerRight - e.clientX;
      const clampedWidth = Math.max(SIDEKICK_MIN_WIDTH, Math.min(SIDEKICK_MAX_WIDTH, newWidth));
      setCurrentWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      saveWidth(currentWidth);
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
  }, [isResizing, currentWidth]);

  const sidekickClassName = clsx(
    styles.sidekick,
    isResizing && styles.sidekickResizing
  );

  // Render the appropriate detail view based on selection type
  const renderDetailView = () => {
    if (!displayedSelection) return null;
    
    switch (displayedSelection.type) {
      case 'machine':
        return <MachineDetail machineId={displayedSelection.id} onClose={onClose} />;
      case 'provider':
        return <ProviderDetail providerId={displayedSelection.id} onClose={onClose} />;
      case 'key':
        return <KeyDetail keyId={displayedSelection.id} onClose={onClose} />;
      case 'deployment':
        return <DeploymentDetail deploymentId={displayedSelection.id} onClose={onClose} />;
      case 'bootstrap':
        return <BootstrapDetail profileId={displayedSelection.id} onClose={onClose} />;
      default:
        return (
          <div className={styles.loading}>
            <span className={styles.loadingText}>Unknown item type</span>
          </div>
        );
    }
  };

  // Don't render anything if we're closed and have no content to show
  if (currentWidth === 0 && !displayedSelection) {
    return null;
  }

  return (
    <div 
      ref={sidekickRef}
      className={sidekickClassName}
      style={{ width: currentWidth }}
    >
      {/* Resize handle */}
      {currentWidth > 0 && (
        <div 
          className={styles.resizeHandle}
          onMouseDown={handleMouseDown}
        >
          <div className={styles.resizeHandleLine} />
        </div>
      )}
      <div className={clsx(styles.sidekickInner, currentWidth === 0 && styles.sidekickInnerHidden)}>
        {renderDetailView()}
      </div>
    </div>
  );
}

// ========== Shared Sidekick Sub-components ==========

interface SidekickHeaderProps {
  icon?: ReactNode;
  iconText?: string;
  name: string;
  nameSans?: boolean;
  subtitle?: string;
  statusBadge?: ReactNode;
  onClose: () => void;
  quickCode?: string;
  quickCodeLabel?: string;
  quickActions?: ReactNode;
}

export function SidekickHeader({
  icon,
  iconText,
  name,
  nameSans,
  subtitle,
  statusBadge,
  onClose,
  quickCode,
  quickCodeLabel,
  quickActions,
}: SidekickHeaderProps) {
  const { addToast } = useAppStore();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast({ type: 'info', title: 'Copied', message: `${label} copied` });
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        {(icon || iconText) && (
          <div className={styles.headerIcon}>
            {iconText ? (
              <span className={styles.headerIconText}>{iconText}</span>
            ) : (
              <span className={styles.headerIconSvg}>{icon}</span>
            )}
          </div>
        )}
        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <h2 className={clsx(styles.name, nameSans && styles.nameSans)}>{name}</h2>
            {statusBadge}
          </div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <button onClick={onClose} className={styles.closeButton}>
          <X size={16} />
        </button>
      </div>

      {(quickCode || quickActions) && (
        <div className={styles.quickActions}>
          {quickCode && (
            <>
              <code className={styles.quickCode}>{quickCode}</code>
              <button
                onClick={() => copyToClipboard(quickCode, quickCodeLabel || 'Value')}
                className={styles.copyButton}
                title="Copy"
              >
                <Copy size={14} />
              </button>
            </>
          )}
          {quickActions}
        </div>
      )}
    </div>
  );
}

interface SidekickTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function SidekickTabs({ tabs, activeTab, onTabChange }: SidekickTabsProps) {
  return (
    <AnimatedTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      className={styles.tabs}
    />
  );
}

export function SidekickContent({ children }: { children: ReactNode }) {
  return <div className={styles.tabContent}>{children}</div>;
}

// Full-height content container - used for template/code views
export function SidekickContentFull({ children }: { children: ReactNode }) {
  return <div className={styles.tabContentFull}>{children}</div>;
}

export function SidekickPanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}

export function SidekickSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

interface SidekickRowProps {
  label: string;
  value?: string | null;
  icon?: ReactNode;
  accent?: boolean;
  copyable?: boolean;
}

export function SidekickRow({ label, value, icon, accent, copyable }: SidekickRowProps) {
  const { addToast } = useAppStore();

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      addToast({ type: 'info', title: 'Copied', message: `${label} copied` });
    }
  };

  return (
    <div className={styles.row}>
      <span className={styles.label}>
        {icon}
        {label}
      </span>
      {copyable && value ? (
        <div className={styles.valueCopyable}>
          <span className={clsx(styles.value, accent && styles.valueAccent)} title={value}>
            {value}
          </span>
          <button onClick={handleCopy} className={styles.copyButton}>
            <Copy size={12} />
          </button>
        </div>
      ) : (
        <span className={clsx(styles.value, accent && styles.valueAccent)} title={value || undefined}>
          {value || '—'}
        </span>
      )}
    </div>
  );
}

export function SidekickGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export function SidekickGridItem({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className={styles.gridItem}>
      <div className={styles.gridLabel}>
        {icon}
        <span>{label}</span>
      </div>
      <span className={styles.gridValue}>{value}</span>
    </div>
  );
}

export function SidekickTags({ tags }: { tags: Record<string, string> | string[] }) {
  if (Array.isArray(tags)) {
    return (
      <div className={styles.tags}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            <span className={styles.tagSimple}>{tag}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.tags}>
      {Object.entries(tags).map(([key, value]) => (
        <span key={key} className={styles.tag}>
          <span className={styles.tagKey}>{key}:</span>
          <span className={styles.tagValue}>{value}</span>
        </span>
      ))}
    </div>
  );
}

export function SidekickLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className={styles.loading}>
      <span className={styles.loadingText}>{message}</span>
    </div>
  );
}

export function SidekickEmpty({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <span className={styles.emptyText}>{message}</span>
    </div>
  );
}

export function SidekickCode({ children }: { children: string }) {
  return <pre className={styles.codeBlock}>{children}</pre>;
}

type CodeLanguage = 'hcl' | 'yaml' | 'bash' | 'json' | 'text';

interface SidekickCodeHighlightProps {
  children: string;
  language?: CodeLanguage;
}

// Custom syntax highlighting theme based on app's design
const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'var(--color-elevated)',
    margin: 0,
    padding: 0,
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
  },
};

export function SidekickCodeHighlight({ children, language = 'hcl' }: SidekickCodeHighlightProps) {
  return (
    <div className={styles.codeHighlight}>
      <SyntaxHighlighter
        language={language}
        style={customTheme}
        customStyle={{
          background: 'var(--color-elevated)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          margin: 0,
          overflow: 'auto',
        }}
        wrapLongLines={false}
        showLineNumbers={true}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: 'var(--space-3)',
          color: 'var(--color-text-muted)',
          textAlign: 'right',
          userSelect: 'none',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// Full-height code view that fills the sidekick content area
interface SidekickFullCodeProps {
  children: string;
  language?: CodeLanguage;
  title?: string;
}

export function SidekickFullCode({ children, language = 'hcl', title }: SidekickFullCodeProps) {
  const { addToast } = useAppStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    addToast({ type: 'info', title: 'Copied', message: 'Template copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.fullCodeContainer}>
      {title && (
        <div className={styles.fullCodeHeader}>
          <span className={styles.fullCodeTitle}>{title}</span>
          <button 
            className={styles.fullCodeCopyButton} 
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}
      <div className={styles.fullCodeContent}>
        <SyntaxHighlighter
          language={language}
          style={customTheme}
          customStyle={{
            background: 'var(--color-elevated)',
            margin: 0,
            padding: 'var(--space-3)',
            height: '100%',
            overflow: 'auto',
          }}
          wrapLongLines={false}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: 'var(--space-3)',
            color: 'var(--color-text-muted)',
            textAlign: 'right',
            userSelect: 'none',
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function SidekickJson({ data }: { data: unknown }) {
  return <pre className={styles.jsonPreview}>{JSON.stringify(data, null, 2)}</pre>;
}

export function SidekickActionBar({ children, spread }: { children: ReactNode; spread?: boolean }) {
  return (
    <div className={clsx(styles.actionBar, spread && styles.actionBarSpread)}>
      {children}
    </div>
  );
}
