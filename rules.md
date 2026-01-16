# Code Quality & Consistency Rules

This document outlines the code quality toolchain and conventions for the Machina project.

---

## 📚 Documentation Policy

**IMPORTANT: Do not create documentation files (`.md`, README, etc.) unless explicitly requested by the user.**

- Documentation should only be written when the user specifically asks for it
- Do not proactively create docs, guides, or README files
- Focus on code implementation first
- If clarification is needed about documentation, ask the user

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

---

## 🧪 Testing Strategy

### Toolchain

| Tool | Purpose | Scope |
|------|---------|-------|
| **Vitest** | Unit & integration tests | Client + Server |
| **React Testing Library** | Component testing | Client |
| **Supertest** | API route testing | Server |
| **Playwright** | E2E browser tests | Full stack |
| **MSW** | API mocking | Client tests |

### Scripts

```bash
npm run test                 # All unit/integration tests
npm run test:client          # Client tests only
npm run test:server          # Server tests only
npm run test:coverage        # Generate coverage report
npm run test:e2e             # Playwright E2E tests
npm run test:e2e:headed      # E2E with browser visible
```

### Conventions

| Type | Pattern | Location |
|------|---------|----------|
| Unit | `*.test.ts(x)` | Co-located with source |
| Integration | `*.integration.test.ts` | `__tests__/integration/` |
| E2E | `*.spec.ts` | `e2e/` |

### Coverage Targets: ≥80% statements, ≥75% branches, ≥80% functions/lines

---

## 📋 Test Implementation Checklist

### Unit Tests (201 tests)

| Module | File | Tests |
|--------|------|-------|
| **Client API** | `client/src/lib/api.ts` | `buildQueryString` (params, empty filter) · `fetchApi` (success, error, headers) · Machines: `get`, `getOne`, `create`, `reboot`, `destroy`, `getMetrics`, `getServices`, `restartService`, `getNetworking`, `sync` · Providers: `get`, `getOptions`, `getAccounts`, `getAccount`, `create`, `verify`, `update`, `delete` · Deployments: `get`, `getOne`, `cancel`, `approve`, `getLogs`, `streamLogs` · Bootstrap: `getProfiles`, `getProfile`, `create`, `update`, `delete`, `getFirewall` · Audit: `getEvents` · SSH: `getKeys`, `getKey`, `generate`, `import`, `getPrivate`, `syncToProvider`, `unsync`, `update`, `delete` |
| **Client Store** | `client/src/store/appStore.ts` | `setSidekickSelection` (selection, terminal ID) · `setTerminalMachineId` · `setMachineFilters` (merge) · `clearMachineFilters` · `setMachineSort` · `setDeployWizardOpen` · `addToast` (ID gen) · `removeToast` |
| **Client Utils** | `client/src/shared/lib/` | `copyToClipboard` · `downloadFile` |
| **UI Components** | `client/src/shared/ui/` | `Button` (variants, disabled, loading, click) · `Badge` (colors) · `Card` (children) · `Modal` (open/close, overlay, escape) · `ConfirmModal` (buttons, confirm) · `Input` (change, error, disabled) · `Select` (options, change) · `Spinner` (sizes) · `DropdownMenu` (toggle, select) · `AnimatedTabs` (switch) · `PageLoader` · `RefreshButton` (loading) |
| **Shared Components** | `client/src/shared/components/` | `ItemCard` (render, click) · `PageEmptyState` (message, action) · `PageLayout` (header, content) · `PageList` (items) · `Toasts` (render, auto-dismiss) |
| **Sidekick** | `client/src/features/sidekick/` | `Sidekick` (show/hide) · `SidekickHeader` (title, close) · `SidekickTabs` (switch) · `SidekickContent` (active tab) · `SidekickSection` (collapse) · `SidekickRow` (label/value) · `SidekickGrid` · `SidekickCode` (highlight) · `SidekickJson` · `SidekickTags` · `SidekickActionBar` · `SidekickLoading` · `SidekickEmpty` |
| **Detail Views** | `client/src/features/sidekick/details/` | `MachineDetail` (info, status, actions) · `ProviderDetail` (info, verify, delete) · `KeyDetail` (info, sync, delete) · `DeploymentDetail` (info, logs stream) · `BootstrapDetail` (info, edit, delete) |
| **Terminal** | `client/src/features/terminal/` | `SSHTerminal` (init, websocket, resize) · `TerminalModal` (open/close) · `TerminalPanel` |
| **App Components** | `client/src/apps/` | `MachinesApp` (list, select, wizard) · `DeployWizard` (validate, submit) · `MachineCard` · `MachineFilters` · `ProvidersApp` (list, modal) · `AddProviderModal` (validate) · `KeysApp` (list, modals) · `GenerateKeyModal` · `ImportKeyModal` (validate) · `DeploymentsApp` (list, status) · `BootstrapApp` · `SettingsApp` |
| **Server Database** | `server/src/services/database.ts` | `encrypt`/`decrypt` (correct, invalid) · Parsers: `Machine`, `Deployment` (double-encoded), `BootstrapProfile`, `FirewallProfile`, `AuditEvent`, `SSHKey` · Machines: `getAll`, `get`, `insert`, `update`, `delete` · AgentMetrics: `get`, `upsert` · Deployments: `getAll`, `getByMachine`, `get`, `insert`, `update` · Providers: `getAll`, `get`, `insert`, `update`, `delete` · Credentials: `get`, `store` · Bootstrap: `getProfiles`, `getProfile`, `insert`, `update`, `delete` · Firewall: `getProfiles`, `getProfile` · Audit: `getEvents`, `insert` · SSH: `getKeys`, `getKey`, `getByFingerprint`, `insert`, `update`, `delete`, `getPrivate`, `storePrivate` |
| **Server Terraform** | `server/src/services/terraform.ts` | `isTerraformAvailable` (PATH, WinGet) · `getTerraformModulesDir` · `TerraformService`: `init` (copy, run), `plan` (vars, run), `apply` (run, outputs), `destroy`, `getOutputs`, `refresh`, `cleanup`, logging, errors |
| **Server Error Handler** | `server/src/middleware/errorHandler.ts` | `AppError` (code, message) · `errorHandler` (JSON, log, unknown) |

---

### Integration Tests (59 tests)

| API | Endpoint | Tests |
|-----|----------|-------|
| **Machines** | `/machines` | `GET /` (list, filter by status/provider/region/tags, search, sort, paginate) · `GET /:id` (found, 404) · `POST /` (create, validate, 404 account, 400 creds) · `POST /:id/reboot` (initiate, validate state) · `POST /:id/destroy` · `GET /:id/services` · `POST /:id/services/:name/restart` · `GET /:id/networking` · `POST /sync` |
| **Providers** | `/providers` | `GET /` (types) · `GET /:type/options` · `GET /accounts` · `GET /accounts/:id` · `POST /:type/accounts` (create, validate) · `POST /accounts/:id/verify` · `PUT /accounts/:id` · `DELETE /accounts/:id` |
| **Deployments** | `/deployments` | `GET /` (list, filter by machine/state/type) · `GET /:id` · `GET /:id/logs` (fetch, SSE stream) · `POST /:id/cancel` · `POST /:id/approve` |
| **Bootstrap** | `/bootstrap` | `GET /profiles` · `GET /profiles/:id` · `POST /profiles` · `PUT /profiles/:id` · `DELETE /profiles/:id` · `GET /firewall-profiles` |
| **SSH Keys** | `/ssh` | `GET /keys` · `GET /keys/:id` · `POST /keys/generate` · `POST /keys/import` · `GET /keys/:id/private` · `POST /keys/:id/sync/:accountId` · `DELETE /keys/:id/sync/:provider` · `PATCH /keys/:id` · `DELETE /keys/:id` |
| **Audit** | `/audit` | `GET /events` (list, filter by action/target/date) |
| **Agent** | `/agent` | `POST /heartbeat` (accept, update status) · `GET /metrics/:machineId` |
| **Client Integration** | — | `App` routing, redirect · `AppLayout` nav · `Appbar` navigation · `Topbar` title · Machine selection → sidekick · Provider modal → list update · Deploy wizard → list · Deployment log streaming |

---

### E2E Tests - Playwright (52 tests)

| Flow | Tests |
|------|-------|
| **Navigation** | App loads · Navigate all pages · Titles update · URLs update · Back/forward |
| **Machines** | Empty state · Open wizard · Fill form · Submit → see machine · Select → details · Networking tab · Services tab · SSH terminal · Reboot · Destroy + confirm · Removed from list · Filter status/provider · Search · Sort · Sync |
| **Providers** | Empty state · Open modal · Select type · Enter creds · Submit → see provider · Select → details · Verify · Edit label · Delete |
| **SSH Keys** | Empty state · Generate modal · Fill form · Submit → see key · Download private · Import modal · Paste key · Submit → see imported · Select → details · Copy public · Sync to provider · Delete |
| **Deployments** | View list · Filter machine/status · Select → details · View logs · SSE streaming · Cancel · Approve |
| **Bootstrap** | View list · Create profile · Edit template · Save · Delete custom · Cannot delete system |
| **Settings** | View page · Toggle theme · Update prefs |
| **Error Handling** | Error toast on API fail · 404 route · Network disconnect · Retry requests · Loading states |
| **Responsive** | Mobile layout · Sidekick collapse · Mobile nav · Mobile forms |

---

## 🔧 Test Configuration

### Vitest (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: { provider: 'v8', reporter: ['text', 'html', 'lcov'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

### Playwright (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
});
```

---

## 📝 Best Practices

**Unit**: Test one behavior · Descriptive names · AAA pattern · Mock externals · Cover edge cases

**Integration**: Use test DB · Clean up between tests · Test real interactions · Verify side effects

**E2E**: Test user journeys · Use `data-testid` · Wait for elements (not timeouts) · Test failures · Keep independent

