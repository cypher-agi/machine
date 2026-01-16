# ⚠️ DEPRECATED

This folder has been moved to the **ZUI** package.

## Migration

Please use `@cypher-agi/zui` instead:

```tsx
// Old (deprecated)
import { PageLayout } from '@/shared/components';

// New (preferred)
import { PageLayout } from '@cypher-agi/zui';
```

## Documentation

See the following files in the `zui/` folder:
- `zui/README.md` - Usage guide
- `zui/MIGRATION.md` - Migration guide
- `zui/COMPONENTS.md` - Component reference
- `zui/ARCHITECTURE.md` - Architecture details

## Backward Compatibility

Old imports still work through re-exports in `client/src/shared/index.ts`, but will be removed in a future version.
