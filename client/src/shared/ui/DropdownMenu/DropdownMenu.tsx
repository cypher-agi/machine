import { type ReactNode, useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '../Button';
import styles from './DropdownMenu.module.css';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  trigger?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ items, trigger, align = 'right', className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item: DropdownMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className={clsx(styles.container, className)} ref={menuRef}>
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={isOpen ? styles.triggerActive : ''}
        >
          <MoreVertical size={16} />
        </Button>
      )}

      {isOpen && (
        <div className={clsx(styles.dropdown, align === 'left' && styles.dropdownLeft)}>
          {items.map((item, index) =>
            item.divider ? (
              <hr key={`divider-${index}`} className={styles.divider} />
            ) : (
              <button
                key={item.id}
                className={clsx(styles.item, item.danger && styles.itemDanger)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(item);
                }}
                disabled={item.disabled}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
