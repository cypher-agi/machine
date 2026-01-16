# Shared Components

This folder re-exports ZUI components for use in the Machina client application.

## ZUI Components

All UI components are imported from `@cypher-agi/zui`. The following components are re-exported through `@/shared`:

- `Sidebar`
- `Toasts`
- `ItemCard` (and sub-components)
- `Page`
- `PageHeader`
- `PageEmptyState`
- `PageList`
- `CollapsibleGroup`
- All atomic components (Button, Input, etc.)
- All other ZUI components

## Usage

```tsx
// Import from shared (recommended for Machina)
import { Button, Card, Modal, Page } from '@/shared';

// Or import directly from ZUI
import { Button, Card, Modal, Page } from '@cypher-agi/zui';
```

## Documentation

See the ZUI package for component documentation:
- `zui/README.md` - Usage guide
- `zui/src/components/` - Component source code