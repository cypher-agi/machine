import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Enable animated height transitions when content changes */
  animateHeight?: boolean;
  /** Make modal take full available height */
  fullHeight?: boolean;
  /** Remove default padding from content area */
  noPadding?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerActions,
  className,
  contentClassName,
  titleClassName,
  initialFocusRef,
  size = 'md',
  animateHeight = false,
  fullHeight = false,
  noPadding = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus on the modal or an initial element when it opens
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, initialFocusRef]);

  // Handle animated height changes
  useLayoutEffect(() => {
    if (!animateHeight || !contentRef.current || !isOpen) return;

    const updateHeight = () => {
      if (contentRef.current) {
        const height = contentRef.current.scrollHeight;
        setContentHeight(height);
      }
    };

    // Initial measurement
    updateHeight();

    // Set up ResizeObserver for content changes
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [animateHeight, isOpen, children]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        ref={modalRef}
        className={clsx(
          styles.modal,
          styles[size],
          fullHeight && styles.fullHeight,
          className
        )}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <h2 className={clsx(styles.title, titleClassName)}>{title}</h2>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          <div className={styles.headerRight}>
            {headerActions && <div className={styles.headerActions}>{headerActions}</div>}
            <button onClick={onClose} className={styles.closeButton}>
              <X size={20} />
            </button>
          </div>
        </div>
        {animateHeight ? (
          <div
            className={styles.contentWrapper}
            style={{ height: contentHeight }}
          >
            <div
              ref={contentRef}
              className={clsx(
                styles.content,
                noPadding && styles.noPadding,
                contentClassName
              )}
            >
              {children}
            </div>
          </div>
        ) : (
          <div
            className={clsx(
              styles.content,
              noPadding && styles.noPadding,
              fullHeight && styles.contentFullHeight,
              contentClassName
            )}
          >
            {children}
          </div>
        )}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
};
