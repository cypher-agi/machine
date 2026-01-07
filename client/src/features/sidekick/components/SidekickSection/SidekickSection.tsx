import { type ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import styles from './SidekickSection.module.css';

export interface SidekickSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function SidekickSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: SidekickSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)} type="button">
        <div className={styles.sectionTitle}>
          {icon}
          {title}
        </div>
        <ChevronDown
          size={14}
          className={clsx(styles.sectionChevron, isOpen && styles.sectionChevronOpen)}
        />
      </button>
      <div className={clsx(styles.sectionContent, isOpen && styles.sectionContentOpen)}>
        <div className={styles.sectionContentInner}>{children}</div>
      </div>
    </div>
  );
}
