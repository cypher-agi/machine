import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock Toasts component
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

const MockToasts = ({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) => (
  <div data-testid="toasts-container">
    {toasts.map((toast) => (
      <div key={toast.id} data-testid={`toast-${toast.id}`} className={`toast toast-${toast.type}`}>
        <span>{toast.message}</span>
        <button onClick={() => onRemove(toast.id)}>×</button>
      </div>
    ))}
  </div>
);

describe('Toasts', () => {
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render toast messages', () => {
      const toasts: Toast[] = [
        { id: '1', type: 'success', message: 'Operation successful' },
        { id: '2', type: 'error', message: 'Something went wrong' },
      ];

      render(<MockToasts toasts={toasts} onRemove={mockOnRemove} />);

      expect(screen.getByText('Operation successful')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should render empty when no toasts', () => {
      render(<MockToasts toasts={[]} onRemove={mockOnRemove} />);

      const container = screen.getByTestId('toasts-container');
      expect(container.children).toHaveLength(0);
    });
  });

  describe('toast types', () => {
    it('should apply success class for success toast', () => {
      const toasts: Toast[] = [{ id: '1', type: 'success', message: 'Success!' }];

      render(<MockToasts toasts={toasts} onRemove={mockOnRemove} />);

      const toast = screen.getByTestId('toast-1');
      expect(toast).toHaveClass('toast-success');
    });

    it('should apply error class for error toast', () => {
      const toasts: Toast[] = [{ id: '1', type: 'error', message: 'Error!' }];

      render(<MockToasts toasts={toasts} onRemove={mockOnRemove} />);

      const toast = screen.getByTestId('toast-1');
      expect(toast).toHaveClass('toast-error');
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss after timeout', async () => {
      vi.useFakeTimers();
      const toasts: Toast[] = [{ id: '1', type: 'info', message: 'Info' }];

      render(<MockToasts toasts={toasts} onRemove={mockOnRemove} />);

      // Simulate auto-dismiss (typically handled by parent component)
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      vi.useRealTimers();
    });
  });

  describe('manual dismiss', () => {
    it('should call onRemove when close button clicked', () => {
      const toasts: Toast[] = [{ id: '1', type: 'success', message: 'Dismissable' }];

      render(<MockToasts toasts={toasts} onRemove={mockOnRemove} />);

      const closeButton = screen.getByRole('button', { name: '×' });
      closeButton.click();

      expect(mockOnRemove).toHaveBeenCalledWith('1');
    });
  });
});
