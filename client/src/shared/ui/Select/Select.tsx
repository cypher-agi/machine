import React from 'react';
import clsx from 'clsx';
import styles from './Select.module.css';

type SelectSize = 'sm' | 'md';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  size?: SelectSize;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ size = 'md', className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={clsx(styles.select, size === 'sm' && styles.sm, className)}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
