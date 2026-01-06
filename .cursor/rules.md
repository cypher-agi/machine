# React Component Rules

GENERAL
- Use React + TypeScript only
- Function components only
- One component = one responsibility
- If not describable in one sentence, split it
- Prefer composition over configuration
- Avoid unnecessary abstraction

PROPS
- Props must be strongly typed
- Avoid boolean soup
- Controlled components use value + onChange
- Uncontrolled components use defaultValue
- Prefer children, slots, and subcomponents over flags

STATE & EFFECTS
- Keep state closest to where it is used
- Do not lift state prematurely
- Render must be pure
- Side effects only in hooks

ARCHITECTURE
- Separate data orchestration from presentation
- Shared UI must not know about routing, global stores, or backend
- Feature components may depend on app concerns

FOLDER STRUCTURE RULES
- Organize by feature first
- features may depend on shared
- shared must not depend on features
- If a component is used only once, keep it in the feature

EXPECTED STRUCTURE
src
  app
  features
    feature
      components
      hooks
      api
  shared
    ui
    components
    hooks
    lib
    styles

COMPONENT STRUCTURE
- Any non-trivial component uses a folder
- One component per file
- index.ts re-exports only

EXPECTED COMPONENT FOLDER
Component
  Component.tsx
  Component.module.css
  Component.test.tsx
  index.ts

STYLING
- Styles are local by default (CSS Modules or Tailwind)
- No inline styles
- Global CSS only for reset, typography, tokens, and theme
- Use design tokens instead of hardcoded values

NAMING
- Feature components use domain-specific names
- Shared UI uses generic names
- Do not genericize until reused

TESTABILITY
- Move complex logic to hooks or utilities
- Components should primarily render UI
