import { RefreshCw } from 'lucide-react';
import { Button } from '../Button';

export interface RefreshButtonProps {
  /** Click handler */
  onRefresh: () => void;
  /** Whether the refresh is in progress */
  isRefreshing?: boolean;
  /** Button title/tooltip */
  title?: string;
  /** Icon size */
  iconSize?: number;
}

export function RefreshButton({
  onRefresh,
  isRefreshing = false,
  title = 'Refresh',
  iconSize = 14,
}: RefreshButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      onClick={onRefresh}
      disabled={isRefreshing}
      title={title}
    >
      <RefreshCw size={iconSize} className={isRefreshing ? 'animate-spin' : ''} />
    </Button>
  );
}

