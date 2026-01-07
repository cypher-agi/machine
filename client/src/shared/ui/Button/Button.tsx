import React from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

type ButtonAsButton = {
  as?: 'button';
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonAsSpan = {
  as: 'span';
} & React.HTMLAttributes<HTMLSpanElement>;

export type ButtonProps = (ButtonAsButton | ButtonAsSpan) & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement | HTMLSpanElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', iconOnly = false, className, as = 'button', ...props },
    ref
  ) => {
    const classNames = clsx(
      styles.button,
      styles[variant],
      size === 'sm' && styles.sm,
      iconOnly && styles.iconOnly,
      className
    );

    if (as === 'span') {
      return (
        <span
          ref={ref as React.Ref<HTMLSpanElement>}
          className={classNames}
          {...(props as React.HTMLAttributes<HTMLSpanElement>)}
        />
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classNames}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      />
    );
  }
);

Button.displayName = 'Button';
