# Machina Design Guide

## Philosophy

Machina follows a **Cursor-inspired dark theme** with a monochromatic black and white aesthetic. The UI should feel professional, minimal, and technical—like a high-end developer tool.

## Color Palette

### Background Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#09090b` | Main app background |
| `--color-surface` | `#0e0e10` | Cards, panels, elevated surfaces |
| `--color-elevated` | `#131316` | Modals, dropdowns, popovers |
| `--color-border` | `#17171a` | Subtle borders |
| `--color-border-light` | `#1f1f23` | More visible borders, hover states |

### Text Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-text-primary` | `#e6e8eb` | Primary text, headings |
| `--color-text-secondary` | `#8b8b8d` | Secondary text, labels |
| `--color-text-muted` | `#6b7280` | Muted text, placeholders, hints |

### Functional Colors (Use Sparingly)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | `#5e9eff` | Primary actions, links, focus states |
| `--color-success` | `#4ade80` | Success states, online indicators |
| `--color-warning` | `#facc15` | Warning states, caution indicators |
| `--color-error` | `#f87171` | Error states, destructive actions |
| `--color-pending` | `#a78bfa` | Pending/loading states |
| `--color-provisioning` | `#5e9eff` | Provisioning states |

### Accent Colors (Very Selective Use)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-neon-cyan` | `#22d3ee` | Special highlights only |
| `--color-neon-green` | `#4ade80` | Status indicators |
| `--color-neon-purple` | `#a78bfa` | Dev/debug features only |

## Color Usage Rules

### ✅ DO
- Use grayscale for 95% of the UI
- Use `rgba(255, 255, 255, 0.XX)` for overlays and subtle effects
- Keep accent colors minimal—only for status and actions
- Use white/gray borders, not colored ones
- Use subtle box-shadows with black, not colored glows

### ❌ DON'T
- Use pink, magenta, or bright gradients
- Use colored backgrounds for large areas
- Use neon glows or "AI slop" aesthetics
- Mix multiple accent colors in the same component
- Use colored shadows or glows (except for status indicators)

## Component Styling

### Buttons
```css
/* Primary - Subtle white */
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.1);
color: var(--color-text-secondary);

/* Hover */
background: rgba(255, 255, 255, 0.12);
color: var(--color-text-primary);
```

### Inputs
```css
background: rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.08);

/* Focus - White glow, not colored */
border-color: rgba(255, 255, 255, 0.25);
box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
```

### Cards & Surfaces
```css
background: var(--color-surface);
border: 1px solid var(--color-border);
```

### Modals
```css
background: var(--color-elevated);
border: 1px solid rgba(255, 255, 255, 0.06);
box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
```

## Typography

### Fonts
- **Sans-serif**: Inter (primary UI text)
- **Monospace**: JetBrains Mono (code, technical data)

### Sizes
| Token | Value | Usage |
|-------|-------|-------|
| `--text-2xs` | 10px | Badges, tiny labels |
| `--text-xs` | 12px | Labels, captions |
| `--text-sm` | 13px | Body text, inputs |
| `--text-base` | 14px | Default text |
| `--text-lg` | 16px | Section headers |
| `--text-xl` | 18px | Page titles |

## Animations

Keep animations subtle and fast:
- `--transition-fast`: 75ms (micro-interactions)
- `--transition-normal`: 150ms (standard transitions)
- `--transition-slow`: 300ms (modal/panel transitions)

Avoid:
- Rotating elements
- Pulsing glows
- Complex multi-step animations
- Colored animation effects

## Examples

### Good: Clean, Monochromatic
```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}
```

### Bad: Colorful, "AI Slop"
```css
.card {
  background: linear-gradient(purple, pink);
  border: 1px solid rgba(244, 114, 182, 0.4);
  box-shadow: 0 0 30px rgba(251, 113, 133, 0.4);
}
```


