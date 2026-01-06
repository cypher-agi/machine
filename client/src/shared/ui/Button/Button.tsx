import React from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  as?: 'button' | 'span';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      iconOnly = false,
      className,
      as = 'button',
      ...props
    },
    ref
  ) => {
    const Component = as;
    return (
      <Component
        ref={ref as any}
        className={clsx(
          styles.button,
          styles[variant],
          size === 'sm' && styles.sm,
          iconOnly && styles.iconOnly,
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
