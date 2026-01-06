import { AnimatedTabs } from '@/shared/ui';
import type { Tab } from '@/shared/ui';
import styles from '../../Sidekick/Sidekick.module.css';

export interface SidekickTabsProps {
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

