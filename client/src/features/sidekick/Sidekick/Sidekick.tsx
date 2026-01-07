import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import type { SidekickSelection } from '@/store/appStore';
import styles from './Sidekick.module.css';

// Import detail views for each item type
import { MachineDetail } from '../details/MachineDetail';
import { ProviderDetail } from '../details/ProviderDetail';
import { KeyDetail } from '../details/KeyDetail';
import { DeploymentDetail } from '../details/DeploymentDetail';
import { BootstrapDetail } from '../details/BootstrapDetail';

const SIDEKICK_MIN_WIDTH = 320;
const SIDEKICK_MAX_WIDTH = 600;
const SIDEKICK_DEFAULT_WIDTH = 384;
const SIDEKICK_MINIMIZED_WIDTH = 40;
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
  const [currentWidth, setCurrentWidth] = useState(0); // Always start at 0 for animation
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [displayedSelection, setDisplayedSelection] = useState<SidekickSelection | null>(null);
  const sidekickRef = useRef<HTMLDivElement>(null);
  const isOpen = !!selection;

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Handle open/close transitions
  useEffect(() => {
    if (isOpen) {
      // Opening - set selection immediately, then animate width open after two frames
      // to ensure the browser has painted the width:0 state first
      setDisplayedSelection(selection);
      const width = getSavedWidth();
      // Double rAF ensures the DOM paints with width 0 before we animate to target width
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setCurrentWidth(width);
        });
      });
      return;
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
    isResizing && styles.sidekickResizing,
    isMinimized && styles.sidekickMinimized
  );

  // Render the appropriate detail view based on selection type
  const renderDetailView = () => {
    if (!displayedSelection) return null;

    const commonProps = { onClose, onMinimize: toggleMinimize };

    switch (displayedSelection.type) {
      case 'machine':
        return <MachineDetail machineId={displayedSelection.id} {...commonProps} />;
      case 'provider':
        return <ProviderDetail providerId={displayedSelection.id} {...commonProps} />;
      case 'key':
        return <KeyDetail keyId={displayedSelection.id} {...commonProps} />;
      case 'deployment':
        return <DeploymentDetail deploymentId={displayedSelection.id} {...commonProps} />;
      case 'bootstrap':
        return <BootstrapDetail profileId={displayedSelection.id} {...commonProps} />;
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

  // Calculate display width - use minimized width when minimized
  const displayWidth = isMinimized ? SIDEKICK_MINIMIZED_WIDTH : currentWidth;

  return (
    <div ref={sidekickRef} className={sidekickClassName} style={{ width: displayWidth }}>
      {/* Minimized bar */}
      {isMinimized ? (
        <div className={styles.minimizedBar}>
          <button className={styles.minimizedExpandButton} onClick={toggleMinimize} title="Expand">
            <ChevronLeft size={16} />
          </button>
          <button className={styles.minimizedCloseButton} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          {/* Resize handle */}
          {currentWidth > 0 && (
            <div className={styles.resizeHandle} onMouseDown={handleMouseDown}>
              <div className={styles.resizeHandleLine} />
            </div>
          )}
          <div
            className={clsx(styles.sidekickInner, currentWidth === 0 && styles.sidekickInnerHidden)}
          >
            {renderDetailView()}
          </div>
        </>
      )}
    </div>
  );
}
