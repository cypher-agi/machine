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
- Apps own their pages, data fetching, and domain logic
- Features provide reusable functionality across apps
- Feature components may depend on app store but not app components

FOLDER STRUCTURE RULES
- Organize by app first, then by feature
- apps are top-level sections visible in the sidebar (Machines, Providers, Keys, Deployments, Bootstrap)
- features are cross-cutting functionality used by multiple apps (Terminal, Sidekick)
- apps may depend on features and shared
- features may depend on shared
- shared must not depend on apps or features
- If a component is used only once, keep it in the app

EXPECTED FRONT-END STRUCTURE
src
  app                    # App shell, layouts, routing
  apps                   # Top-level sidebar sections
    machines
      components
      hooks
      api
    providers
    keys
    deployments
    bootstrap
  features               # Cross-cutting functionality
    terminal
      components
      hooks
    sidekick
      components
  shared
    ui                   # Generic UI primitives (Button, Modal, Input)
    components           # Reusable composed components
    hooks
    lib
    styles

COMPONENT STRUCTURE
- Components must have their own folder
- One component per file
- Modular css per component
- index.ts re-exports only

EXPECTED COMPONENT FOLDER
Component
  Component.tsx
  Component.module.css
  Component.test.tsx
  index.ts

STYLING
- Styles are local by default (CSS Modules or Tailwind)
- No inline styles except for dynamic values computed at runtime (e.g., width/height for resizable panels, progress bars, animation transforms)
- Global CSS only for reset, typography, tokens, and theme
- Use design tokens instead of hardcoded values

NAMING
- App components use domain-specific names (MachineCard, ProviderList)
- Feature components use functionality-specific names (TerminalPanel, SSHTerminal)
- Shared UI uses generic names (Button, Modal, Card)
- Do not genericize until reused

TESTABILITY
- Move complex logic to hooks or utilities
- Components should primarily render UI