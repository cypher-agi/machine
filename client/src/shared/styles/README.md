# ⚠️ DEPRECATED

This folder has been moved to the **ZUI** package.

## Migration

Styles are now imported automatically via `@cypher-agi/zui/styles`:

```css
/* client/src/index.css */
@import '@cypher-agi/zui/styles';
```

## Design Tokens

All design tokens are still available as CSS custom properties. See `zui/src/styles/tokens.css` for the complete list.

## Documentation

See the following files in the `zui/` folder:
- `zui/src/styles/DESIGN_GUIDE.md` - Design principles
- `zui/README.md` - Usage guide
- `zui/ARCHITECTURE.md` - Architecture details

## Backward Compatibility

Styles are automatically imported through the new system. No action needed unless you were importing these files directly.
