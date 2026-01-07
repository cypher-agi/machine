# User Authentication Implementation Plan

## Overview

This document outlines the implementation plan for adding user authentication to the Machine dashboard. The system will support email/password login, profile pictures, session management, and proper user attribution for all actions.

---

## 1. Database Schema Changes

### New Tables

#### `users` table
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profile_picture_path TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_users_email ON users(email);
```

#### `sessions` table
```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### Modified Tables

Add `created_by_user_id` to existing tables:

```sql
-- Add to machines table
ALTER TABLE machines ADD COLUMN created_by_user_id TEXT;

-- Add to provider_accounts table  
ALTER TABLE provider_accounts ADD COLUMN created_by_user_id TEXT;

-- Add to ssh_keys table
ALTER TABLE ssh_keys ADD COLUMN created_by_user_id TEXT;

-- Add to bootstrap_profiles table (if not already there)
-- Already has created_by field, may need to migrate to user_id
```

---

## 2. Shared Types

### `shared/src/types/user.ts`

```typescript
export interface User {
  user_id: string;
  email: string;
  display_name: string;
  profile_picture_url?: string;
  role: 'admin' | 'user' | 'readonly';
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

// Never send password_hash to client
export type SafeUser = Omit<User, never>; // same as User, password_hash is in DB only

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  session_token: string;
  expires_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface UpdateProfileRequest {
  display_name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

export interface Session {
  session_id: string;
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  is_current?: boolean;
}
```

---

## 3. Backend Implementation

### 3.1 New Route: `/api/auth`

**File: `server/src/routes/auth.ts`**

```typescript
// POST /api/auth/login - Login with email/password
// POST /api/auth/logout - Logout current session
// POST /api/auth/register - Register new user (admin only, or first user)
// GET  /api/auth/me - Get current user
// PUT  /api/auth/me - Update current user profile
// POST /api/auth/me/avatar - Upload profile picture
// DELETE /api/auth/me/avatar - Remove profile picture
// GET  /api/auth/sessions - List user's active sessions
// DELETE /api/auth/sessions/:id - Revoke a session
// POST /api/auth/dev-login - Dev-only bypass (only in dev mode)
```

### 3.2 Auth Middleware

**File: `server/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

// Main auth middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Check for Authorization header (Bearer token)
  // 2. Validate session token
  // 3. Check session not expired
  // 4. Attach user and session to request
  // 5. Update session last_activity_at
}

// Optional auth - doesn't fail if not logged in
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Same as requireAuth but doesn't fail
}

// Role-based access
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  };
}
```

### 3.3 Password Hashing

Use `bcrypt` for secure password hashing:

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 3.4 Session Token Generation

```typescript
import crypto from 'crypto';

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

### 3.5 Profile Picture Upload

Store profile pictures in `.data/avatars/` directory:

```typescript
// POST /api/auth/me/avatar
// - Accept multipart/form-data with 'avatar' field
// - Validate image type (jpeg, png, webp, gif)
// - Resize to max 256x256
// - Save as user_id.webp
// - Return URL: /api/auth/avatars/:user_id
```

### 3.6 Dev Login Bypass

```typescript
// Only enabled when process.env.NODE_ENV !== 'production'
// POST /api/auth/dev-login
// - Creates or uses existing dev user (dev@localhost)
// - Immediately returns valid session
// - Useful for quick testing
```

---

## 4. Apply Auth to All Routes

### 4.1 Protected Routes

All existing routes need auth middleware applied:

```typescript
// server/src/index.ts
import { requireAuth } from './middleware/auth';

// Public routes (no auth required)
app.get('/health', ...);
app.use('/api/auth', authRouter);

// All other API routes require auth
app.use('/api/machines', requireAuth, machinesRouter);
app.use('/api/providers', requireAuth, providersRouter);
app.use('/api/deployments', requireAuth, deploymentsRouter);
app.use('/api/bootstrap', requireAuth, bootstrapRouter);
app.use('/api/audit', requireAuth, auditRouter);
app.use('/api/agent', agentRouter); // Agent uses machine token, not user auth
app.use('/api/ssh', requireAuth, sshRouter);
```

### 4.2 User Attribution

Update all create/update operations to include user ID:

```typescript
// Example: machines.ts POST handler
const newMachine: Machine = {
  ...existingFields,
  created_by_user_id: req.user!.user_id,
};

// Audit events now use real user
database.insertAuditEvent({
  event_id: uuidv4(),
  action: 'machine.create',
  outcome: 'success',
  actor_id: req.user!.user_id,
  actor_type: 'user',
  actor_name: req.user!.display_name,
  // ... rest
});
```

---

## 5. Frontend Implementation

### 5.1 Auth Store

**File: `client/src/store/authStore.ts`**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  devLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      isLoading: true,
      
      login: async (email, password) => {
        const response = await authApi.login({ email, password });
        set({ 
          user: response.user, 
          sessionToken: response.session_token,
          isAuthenticated: true 
        });
      },
      
      // ... other methods
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ sessionToken: state.sessionToken }),
    }
  )
);
```

### 5.2 Auth API Client

**File: `client/src/lib/authApi.ts`**

```typescript
export async function login(data: LoginRequest): Promise<LoginResponse>;
export async function logout(): Promise<void>;
export async function getMe(): Promise<User>;
export async function updateMe(data: UpdateProfileRequest): Promise<User>;
export async function uploadAvatar(file: File): Promise<User>;
export async function deleteAvatar(): Promise<User>;
export async function getSessions(): Promise<Session[]>;
export async function revokeSession(id: string): Promise<void>;
export async function devLogin(): Promise<LoginResponse>;
```

### 5.3 API Client Auth Integration

Update `client/src/lib/api.ts` to include auth token:

```typescript
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { sessionToken } = useAuthStore.getState();
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
      ...options?.headers,
    },
  });

  // Handle 401 - clear auth state
  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }

  // ... rest of handler
}
```

### 5.4 Auth Guard Component

**File: `client/src/features/auth/AuthGuard.tsx`**

```tsx
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

### 5.5 Login Page

**File: `client/src/apps/login/LoginPage.tsx`**

Features:
- Email/password form with validation
- Error handling for invalid credentials
- "Remember me" checkbox (extends session)
- Link to register (if enabled)
- Dev login button (only in development)

**Design:**
- Clean, centered card design
- Matches existing app aesthetic (dark theme)
- Machine logo/branding at top

### 5.6 Profile Settings

Add to existing Settings page or create Profile section:
- View/edit display name
- View/change email
- Change password
- Upload/remove profile picture
- View active sessions with ability to revoke
- Logout from all devices

### 5.7 User Menu

Add to AppLayout header:
- Profile picture (or initials fallback)
- Dropdown with:
  - Display name
  - Profile link
  - Logout button

---

## 6. Route Structure Update

```typescript
// App.tsx
function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected routes */}
      <Route path="/" element={
        <AuthGuard>
          <AppLayout />
        </AuthGuard>
      }>
        <Route index element={<Navigate to="/machines" replace />} />
        <Route path="machines" element={<MachinesApp />} />
        {/* ... other protected routes */}
        <Route path="profile" element={<ProfileApp />} />
      </Route>
    </Routes>
  );
}
```

---

## 7. Implementation Order

### Phase 1: Core Auth Backend (Priority)
1. Add database tables for users and sessions
2. Create auth routes (login, logout, me)
3. Implement auth middleware
4. Seed initial admin user

### Phase 2: Frontend Auth
1. Create auth store
2. Create login page
3. Add AuthGuard to routes
4. Add auth header to API calls
5. Add user menu to layout

### Phase 3: Dev Login
1. Add dev login endpoint (dev mode only)
2. Add dev login button to login page
3. Auto-seed dev user

### Phase 4: Profile Features
1. Profile picture upload
2. Profile editing
3. Password change
4. Session management

### Phase 5: User Attribution
1. Add created_by_user_id to relevant tables
2. Update all create operations
3. Update audit events with real user info

### Phase 6: Polish
1. "Remember me" functionality
2. Session cleanup job
3. Rate limiting on auth endpoints
4. Additional security headers

---

## 8. Security Considerations

1. **Password Storage**: Use bcrypt with cost factor 12+
2. **Session Tokens**: 256-bit random tokens, stored hashed
3. **Token Transmission**: Always over HTTPS in production
4. **Session Expiry**: 24 hours default, 30 days with "remember me"
5. **Rate Limiting**: 5 login attempts per minute per IP
6. **CSRF**: Consider for cookie-based sessions (we use Bearer tokens)
7. **XSS**: Sanitize user input, use HttpOnly for any cookies

---

## 9. Dev Login Details

For development convenience:

```typescript
// Only available when NODE_ENV !== 'production'
// POST /api/auth/dev-login

// Creates user if not exists:
// - email: dev@localhost
// - password: (any)
// - display_name: "Developer"
// - role: admin

// Returns valid session immediately
// No password check in dev mode
```

Frontend shows "Dev Login" button only when `import.meta.env.DEV === true`.

---

## 10. Files to Create/Modify

### New Files
```
shared/src/types/user.ts
server/src/routes/auth.ts
server/src/middleware/auth.ts
server/src/services/auth.ts
client/src/store/authStore.ts
client/src/lib/authApi.ts
client/src/features/auth/AuthGuard.tsx
client/src/features/auth/LoginPage.tsx
client/src/features/auth/LoginPage.module.css
client/src/features/auth/UserMenu.tsx
client/src/features/auth/UserMenu.module.css
client/src/apps/profile/ProfileApp.tsx
client/src/apps/profile/ProfileApp.module.css
```

### Modified Files
```
shared/src/index.ts (export user types)
server/src/index.ts (add auth routes, middleware)
server/src/services/database.ts (add user/session tables, user attribution columns)
server/src/routes/machines.ts (add user attribution)
server/src/routes/providers.ts (add user attribution)
server/src/routes/ssh.ts (add user attribution)
server/src/routes/bootstrap.ts (add user attribution)
client/src/App.tsx (add login route, AuthGuard)
client/src/main.tsx (initialize auth state)
client/src/lib/api.ts (add auth headers)
client/src/app/layouts/AppLayout.tsx (add UserMenu)
```

---

## 11. Package Dependencies

### Server (add to server/package.json)
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/multer": "^1.4.11"
  }
}
```

### Client
No additional dependencies needed (using existing fetch, zustand).

---

## Summary

This implementation plan provides:

✅ Email/password authentication  
✅ Profile pictures with upload  
✅ User attribution on all actions  
✅ Session management with logout  
✅ Dev login bypass for testing  
✅ Protected routes (must be logged in)  
✅ Clean separation of concerns  
✅ Security best practices  


