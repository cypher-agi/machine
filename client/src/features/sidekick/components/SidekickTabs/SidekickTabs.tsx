import { Tabs } from '@/shared';
import type { Tab } from '@/shared';
import styles from './SidekickTabs.module.css';

export interface SidekickTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function SidekickTabs({ tabs, activeTab, onTabChange }: SidekickTabsProps) {
  return (
    <Tabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      className={styles['tabs'] ?? ''}
    />
  );
}
