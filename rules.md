# Code Quality & Consistency Rules

This document outlines the code quality toolchain and conventions for the Machina project.

---

## 🛠️ Toolchain Overview

| Tool | Purpose | Config File |
|------|---------|-------------|
| **Prettier** | Code formatting | `.prettierrc` |
| **ESLint** | Linting & code quality | `eslint.config.js` |
| **TypeScript** | Type checking (strict mode) | `tsconfig.json` (per workspace) |
| **Husky** | Git hooks | `.husky/` |
| **lint-staged** | Run linters on staged files | `.lintstagedrc.json` |

---

## 📋 Available Scripts

Run from the project root:

```bash
# Linting
npm run lint          # Run ESLint on all files
npm run lint:fix      # Run ESLint with auto-fix

# Formatting
npm run format        # Format all files with Prettier
npm run format:check  # Check formatting without changes

# Type Checking
npm run typecheck     # Run TypeScript type checking on all workspaces
```

---

## ✅ Pre-commit Hooks

On every commit, Husky + lint-staged automatically runs:

1. **ESLint** with auto-fix on staged `.js`, `.jsx`, `.ts`, `.tsx` files
2. **Prettier** formatting on all staged files

This ensures code quality before changes reach the repository.

---

## 🔧 TypeScript Strict Mode

All workspaces use TypeScript's strict settings:

### Core Strict Options (Enabled)
- `strict: true` — Enable all strict type-checking options
- `noImplicitAny: true` — Error on expressions and declarations with `any` type
- `strictNullChecks: true` — Include `null` and `undefined` in type checking
- `strictFunctionTypes: true` — Enable strict checking of function types
- `strictBindCallApply: true` — Enable strict `bind`, `call`, and `apply` methods
- `strictPropertyInitialization: true` — Ensure class properties are initialized
- `useUnknownInCatchVariables: true` — Type catch clause variables as `unknown`
- `alwaysStrict: true` — Emit `"use strict"` for all files

### Additional Checks (Enabled)
- `noUnusedLocals: true` — Report errors on unused local variables
- `noUnusedParameters: true` — Report errors on unused parameters
- `noImplicitReturns: true` — Ensure all code paths return a value
- `noFallthroughCasesInSwitch: true` — Report errors for fallthrough switch cases
- `noImplicitOverride: true` — Require `override` keyword for overriding methods
- `forceConsistentCasingInFileNames: true` — Ensure consistent casing in imports

### Future Strictness Goals (Enable Gradually)
These options are commented out in `tsconfig.json` files. Enable as codebase improves:

- `exactOptionalPropertyTypes` — Differentiate between `undefined` and optional
- `noUncheckedIndexedAccess` — Add `undefined` to index signatures  
- `noPropertyAccessFromIndexSignature` — Require bracket notation for index access

---

## 📝 ESLint Rules

### TypeScript Rules
- Consistent type imports: `import type { X }` or `import { type X }`
- Warn on `any` usage (prefer `unknown`)
- Warn on non-null assertions (`!`)
- Unused variables must be prefixed with `_`

### React Rules (client only)
- Hooks rules enforced (`rules-of-hooks`, `exhaustive-deps`)
- No `target="_blank"` without `rel="noopener"`
- Keys required in lists
- React-refresh compatible exports

---

## 🎨 Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

---

## 📂 Project Structure

```
machina/
├── .husky/              # Git hooks
│   └── pre-commit       # Runs lint-staged
├── .prettierrc          # Prettier config
├── .prettierignore      # Files to skip formatting
├── .lintstagedrc.json   # lint-staged config
├── eslint.config.js     # ESLint flat config
├── client/              # React frontend
│   └── tsconfig.json    # Client TS config
├── server/              # Express backend
│   └── tsconfig.json    # Server TS config
└── shared/              # Shared types
    └── tsconfig.json    # Shared TS config
```

---

## 🚀 Getting Started

After cloning the repository:

```bash
# Install dependencies (also sets up Husky)
npm install

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Format code
npm run format
```

---

## 🔄 CI/CD Recommendations

For continuous integration, run these checks:

```bash
npm run format:check    # Verify formatting
npm run lint            # Check for lint errors
npm run typecheck       # Verify types
npm run build           # Ensure build succeeds
```

---

## 📌 Best Practices

1. **Always run `npm run lint:fix` before committing** (or let pre-commit hook handle it)
2. **Don't disable TypeScript strict checks** without team discussion
3. **Prefer `unknown` over `any`** — cast explicitly when needed
4. **Use consistent type imports** — `import { type X }` for type-only imports
5. **Fix warnings, don't ignore them** — warnings become tech debt

---

## ⚠️ Troubleshooting

### ESLint not finding config
```bash
# Ensure you're in the project root
npm run lint
```

### Prettier conflicts with ESLint
The config includes `eslint-config-prettier` which disables formatting rules in ESLint. Let Prettier handle formatting, ESLint handle code quality.

### Pre-commit hook not running
```bash
# Reinstall Husky
npm run prepare
```

