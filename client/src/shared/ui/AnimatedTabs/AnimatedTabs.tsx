import { useRef, useState, useEffect, useLayoutEffect, useCallback, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './AnimatedTabs.module.css';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface AnimatedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  tabClassName?: string;
  size?: 'sm' | 'md';
}

export function AnimatedTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  tabClassName,
  size = 'sm',
}: AnimatedTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  const updateIndicator = useCallback(() => {
    const activeButton = tabRefs.current.get(activeTab);
    const container = containerRef.current;

    if (activeButton && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });

      // Enable transitions after first render
      if (!isInitialized) {
        requestAnimationFrame(() => setIsInitialized(true));
      }
    }
  }, [activeTab, isInitialized]);

  // Use useLayoutEffect for initial measurement to prevent flash
  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Also update on resize
  useEffect(() => {
    const handleResize = () => updateIndicator();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateIndicator]);

  return (
    <div className={clsx(styles.tabs, className)}>
      <div ref={containerRef} className={styles.tabList}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) {
                tabRefs.current.set(tab.id, el);
              } else {
                tabRefs.current.delete(tab.id);
              }
            }}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              styles.tab,
              size === 'md' && styles.tabMd,
              activeTab === tab.id && styles.active,
              tabClassName
            )}
          >
            {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
        <div
          className={clsx(styles.indicator, isInitialized && styles.indicatorAnimated)}
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: indicatorStyle.width,
          }}
        />
      </div>
    </div>
  );
}
