import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure?',
  };

  describe('buttons', () => {
    it('should render confirm and cancel buttons', () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should use custom button labels', () => {
      render(<ConfirmModal {...defaultProps} confirmLabel="Delete" cancelLabel="Keep" />);

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    });
  });

  describe('confirm action', () => {
    it('should call onConfirm when confirm button is clicked', () => {
      const onConfirm = vi.fn();
      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ConfirmModal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('message', () => {
    it('should render message text', () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('should render complex message content', () => {
      render(
        <ConfirmModal
          {...defaultProps}
          message={
            <div>
              <strong>Warning:</strong> This cannot be undone.
            </div>
          }
        />
      );
      expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should disable buttons when isLoading is true', () => {
      render(<ConfirmModal {...defaultProps} isLoading />);

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('should enable buttons when isLoading is false', () => {
      render(<ConfirmModal {...defaultProps} isLoading={false} />);

      expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
    });
  });

  describe('danger mode', () => {
    it('should apply danger styling when danger is true', () => {
      render(<ConfirmModal {...defaultProps} danger />);
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      // CSS modules hash class names, check if any class contains 'dangerButton'
      const hasDangerClass = Array.from(confirmButton.classList).some((cls) =>
        cls.includes('dangerButton')
      );
      expect(hasDangerClass).toBe(true);
    });
  });

  describe('title', () => {
    it('should render title', () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });
  });

  describe('visibility', () => {
    it('should not render when isOpen is false', () => {
      render(<ConfirmModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<ConfirmModal {...defaultProps} isOpen />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
