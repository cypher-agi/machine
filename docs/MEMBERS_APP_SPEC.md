# Members App Specification

## Overview

The Members App provides a dedicated view for listing and viewing all members within the currently selected team. Unlike the Team detail panel (which shows members as a tab within team settings), this app offers a first-class, standalone experience focused specifically on team membership management.

**Access:** All team members (both admins and regular members) can view the Members app. Certain management actions (role changes, removal) are restricted to team admins.

---

## File Structure

```
client/src/apps/members/
├── MembersApp.tsx              # Main app component
├── MembersApp.module.css       # App-specific styles
├── index.ts                    # Barrel export
└── components/
    ├── index.ts                # Components barrel export
    └── InviteMemberModal/
        ├── InviteMemberModal.tsx
        ├── InviteMemberModal.module.css
        └── index.ts
```

---

## Data Types

### Existing Types (from `@machina/shared`)

```typescript
// Already defined in shared/src/types/team.ts
export interface TeamMember {
  team_member_id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;            // 'admin' | 'member'
  joined_at: string;
  invited_by?: string;
}

export interface TeamMemberWithUser extends TeamMember {
  user: {
    user_id: string;
    display_name: string;
    email: string;
    profile_picture_url?: string | undefined;
  };
}
```

### New/Extended Types

```typescript
// To be added to shared/src/types/team.ts

// Filter options for member list
export interface TeamMemberListFilter {
  role?: TeamRole;           // Filter by role
  search?: string;           // Search by name or email
}

// Extended member info for detail view
export interface TeamMemberDetail extends TeamMemberWithUser {
  invited_by_user?: {
    user_id: string;
    display_name: string;
  };
}
```

---

## API Endpoints

### New Endpoints

#### `GET /api/teams/current/members`
Get members of the currently selected team (via `X-Team-Id` header).

**Request Headers:**
- `Authorization: Bearer <token>`
- `X-Team-Id: <team_id>` (set automatically by API client)

**Query Parameters:**
- `role?: 'admin' | 'member'` - Filter by role
- `search?: string` - Search term for name/email

**Response:**
```typescript
{
  success: true,
  data: TeamMemberWithUser[]
}
```

#### `GET /api/teams/current/members/:memberId`
Get detailed info for a specific member.

**Response:**
```typescript
{
  success: true,
  data: TeamMemberDetail
}
```

### Existing Endpoints (already available)

These existing endpoints from the teams router can be reused:

- `PUT /api/teams/:id/members/:memberId` - Update member role
- `DELETE /api/teams/:id/members/:memberId` - Remove member
- `POST /api/teams/:id/invites` - Generate invite code

---

## Client API Functions

Add to `client/src/lib/api.ts`:

```typescript
// ============ Members API ============

export interface MemberListParams extends TeamMemberListFilter {
  // Currently no pagination needed, teams are typically small
}

export async function getTeamMembers(params?: MemberListParams): Promise<TeamMemberWithUser[]> {
  return fetchApi<TeamMemberWithUser[]>(`/teams/current/members${buildQueryString(params)}`);
}

export async function getTeamMember(memberId: string): Promise<TeamMemberDetail> {
  return fetchApi<TeamMemberDetail>(`/teams/current/members/${memberId}`);
}

// Existing functions already support member management:
// - updateTeamMemberRole(teamId, memberId, role)
// - removeTeamMember(teamId, memberId)
// - createTeamInvite(teamId)
```

---

## Components

### MembersApp

Main app component following the established patterns.

**Key Features:**
- Page header with title "Members" and member count
- Search input for filtering by name/email
- Role filter toggle (All / Admins / Members)
- Refresh button
- Invite button (visible to admins only)
- Member list using `PageList` and `ItemCard` components
- Empty state when no members (should never happen - team always has at least one admin)

**Component Structure:**
```tsx
<PageLayout
  title="Members"
  count={members?.length ?? 0}
  isLoading={isLoading}
  actions={
    <>
      {/* Search input */}
      {/* Role filter buttons */}
      <RefreshButton />
      {isAdmin && <Button>Invite</Button>}
    </>
  }
>
  {members && members.length > 0 ? (
    <PageList>
      {members.map(member => (
        <ItemCard ... />
      ))}
    </PageList>
  ) : (
    <PageEmptyState title="No members found" />
  )}
</PageLayout>
```

**ItemCard Display for Each Member:**
- **Icon Badge:** User avatar (image or initials)
- **Title:** Display name (sans-serif)
- **Status Badge:** Role badge (Admin = green, Member = muted)
- **Meta Row:** 
  - Email address
  - Joined date (relative, e.g., "3 months ago")
- **Actions (on hover, for admins only):**
  - Toggle role button
  - Remove member button

### InviteMemberModal

Modal for generating and sharing invite links.

**Features:**
- Generate new invite code
- Display shareable invite link
- Copy to clipboard button
- Show expiration (7 days from creation)
- List of pending/active invites (admin only)
- Revoke invite functionality

---

## Sidekick Integration

### Update SidekickItemType

In `client/src/store/appStore.ts`:

```typescript
export type SidekickItemType =
  | 'machine'
  | 'provider'
  | 'key'
  | 'deployment'
  | 'bootstrap'
  | 'team'
  | 'integration'
  | 'member';        // NEW
```

### MemberDetail Component

New sidekick detail view at `client/src/features/sidekick/details/MemberDetail/`:

```
MemberDetail/
├── MemberDetail.tsx           # Main component with tabs
├── MemberDetail.module.css    # Styles
├── MemberOverview.tsx         # Overview tab content
├── MemberActivity.tsx         # Activity tab (future: audit log)
└── index.ts
```

**MemberDetail Structure:**

```tsx
<SidekickHeader
  icon={<Avatar />}
  name={member.user.display_name}
  nameSans
  subtitle={member.user.email}
  statusBadge={<RoleBadge role={member.role} />}
  onClose={onClose}
  onMinimize={onMinimize}
/>

<SidekickTabs
  tabs={[
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' }  // Future feature
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>

<SidekickContent>
  {activeTab === 'overview' && <MemberOverview member={member} isAdmin={isAdmin} />}
  {activeTab === 'activity' && <MemberActivity memberId={member.team_member_id} />}
</SidekickContent>

{isAdmin && !isSelf && (
  <SidekickActionBar>
    <Button onClick={handleToggleRole}>
      {member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
    </Button>
    <Button variant="ghost" className={dangerButton} onClick={handleRemove}>
      Remove from Team
    </Button>
  </SidekickActionBar>
)}
```

**MemberOverview Content:**
- Member Info Section:
  - Display name
  - Email
  - Profile picture (if available)
- Team Membership Section:
  - Role (Admin/Member)
  - Joined date (absolute and relative)
  - Invited by (if applicable, with user name)
- Quick Actions (for admins):
  - Change role
  - Remove from team

### Update Sidekick.tsx

Add case for 'member' type in the `renderDetailView` function:

```typescript
case 'member':
  return <MemberDetail memberId={displayedSelection.id} {...commonProps} />;
```

---

## Navigation

### Update Appbar

Add Members to the navigation in `client/src/app/layouts/Appbar/Appbar.tsx`:

```typescript
import { Users } from 'lucide-react';

const navItems: NavItem[] = [
  { to: '/machines', icon: Server, label: 'Machines' },
  { to: '/providers', icon: Cloud, label: 'Providers' },
  { to: '/keys', icon: Key, label: 'Keys' },
  { to: '/deployments', icon: GitBranch, label: 'Deployments' },
  { to: '/bootstrap', icon: Package, label: 'Bootstrap' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/members', icon: Users, label: 'Members' },  // NEW
];
```

**Note:** The `Users` icon from lucide-react is appropriate as it represents multiple people.

### Update App.tsx Routes

Add route for MembersApp:

```typescript
const MembersApp = lazy(() =>
  import('./apps/members/MembersApp').then((m) => ({ default: m.MembersApp }))
);

// In Routes:
<Route
  path="members"
  element={
    <Suspense fallback={<PageLoader />}>
      <MembersApp />
    </Suspense>
  }
/>
```

### Update apps/index.ts

Add barrel export:

```typescript
export { MembersApp } from './members';
```

---

## Server Implementation

### New Route File

Create `server/src/routes/members.ts`:

```typescript
import { Router, type Request, type Response } from 'express';
import { database } from '../services/database';
import { requireAuth } from '../middleware/auth';
import { getTeamIdFromRequest, requireTeamAccess } from '../middleware/teamAuth';
import type { ApiResponse, TeamMemberWithUser, TeamMemberDetail } from '@machina/shared';

export const membersRouter = Router();

/**
 * GET /api/teams/current/members
 * List members of the current team
 */
membersRouter.get('/current/members', requireAuth, requireTeamAccess(), (req, res, next) => {
  try {
    const teamId = getTeamIdFromRequest(req);
    const { role, search } = req.query;
    
    let members = database.getTeamMembers(teamId);
    
    // Apply filters
    if (role && (role === 'admin' || role === 'member')) {
      members = members.filter(m => m.role === role);
    }
    
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      members = members.filter(m => 
        m.user.display_name.toLowerCase().includes(searchLower) ||
        m.user.email.toLowerCase().includes(searchLower)
      );
    }
    
    const response: ApiResponse<TeamMemberWithUser[]> = {
      success: true,
      data: members
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/current/members/:memberId
 * Get detailed info for a specific member
 */
membersRouter.get('/current/members/:memberId', requireAuth, requireTeamAccess(), (req, res, next) => {
  try {
    const memberId = req.params.memberId;
    const member = database.getTeamMemberById(memberId);
    
    if (!member) {
      throw new AppError(404, 'NOT_FOUND', 'Member not found');
    }
    
    // Get invited_by user info if applicable
    let invitedByUser = undefined;
    if (member.invited_by) {
      const inviter = database.getUser(member.invited_by);
      if (inviter) {
        invitedByUser = {
          user_id: inviter.user_id,
          display_name: inviter.display_name
        };
      }
    }
    
    const response: ApiResponse<TeamMemberDetail> = {
      success: true,
      data: {
        ...member,
        invited_by_user: invitedByUser
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});
```

### Register Route

In `server/src/index.ts`:

```typescript
import { membersRouter } from './routes/members';

// Register after other team routes
app.use('/api/teams', membersRouter);
```

---

## Styling

### CSS Variables Used

The app should use existing CSS variables from the design system:

```css
/* Colors */
--surface-1, --surface-2, --surface-3      /* Background layers */
--text-primary, --text-secondary, --text-tertiary
--status-running, --status-running-bg       /* For admin badge */
--border-subtle, --border-default

/* Typography */
--font-sans, --font-mono

/* Spacing via existing patterns */
```

### MembersApp.module.css

Follow patterns from `TeamsApp.module.css`:

```css
.avatarBadge {
  width: 32px;
  height: 32px;
  border-radius: 50%;  /* Circular for members (vs square for teams) */
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  overflow: hidden;
}

.avatarImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.roleBadge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.roleBadgeAdmin {
  background: var(--status-running-bg);
  color: var(--status-running);
}

.roleBadgeMember {
  background: var(--surface-2);
  color: var(--text-secondary);
}

.emailText {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Filter buttons group */
.filterGroup {
  display: flex;
  gap: 2px;
  background: var(--surface-2);
  padding: 2px;
  border-radius: 6px;
}

.filterButton {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filterButtonActive {
  background: var(--surface-3);
  color: var(--text-primary);
}
```

---

## User Interactions

### Member Selection
1. User clicks on a member row
2. `setSidekickSelection({ type: 'member', id: member.team_member_id })` is called
3. Sidekick panel opens with MemberDetail component

### Role Toggle (Admin Only)
1. Admin hovers over member row, toggle button appears
2. Admin clicks toggle button
3. Confirmation handled inline (optimistic update)
4. API call to `updateTeamMemberRole`
5. Toast notification on success/error
6. Query invalidation refreshes list

### Remove Member (Admin Only)
1. Admin clicks remove button on member row (or in sidekick)
2. Confirmation modal appears
3. On confirm, API call to `removeTeamMember`
4. Toast notification
5. Query invalidation, sidekick closes if viewing removed member

### Invite Member (Admin Only)
1. Admin clicks "Invite" button
2. InviteMemberModal opens
3. Modal generates new invite or shows existing active invites
4. Admin copies invite link
5. Modal can be closed; invites persist

---

## Query Keys

```typescript
// Member list
['members', currentTeamId, filters]

// Individual member detail
['member', memberId]

// Team invites (for InviteMemberModal)
['team-invites', currentTeamId]
```

---

## Error States

1. **No team selected:** Should not occur (AuthGuard ensures team context)
2. **API error:** Show toast with error message
3. **Member not found:** Show "Member not found" in sidekick
4. **Permission denied:** Show appropriate error, hide restricted actions

---

## Testing Considerations

### Unit Tests
- MembersApp renders correctly with mock data
- Filter functionality works correctly
- Role badges display correctly based on role
- Admin-only actions are hidden for non-admins

### E2E Tests (Playwright)
- Navigate to /members
- Member list displays correctly
- Click member opens sidekick
- Search filters list correctly
- Role filter works
- (Admin) Role toggle works
- (Admin) Remove member works
- (Admin) Invite modal works

---

## Implementation Order

1. **Server-side:**
   - Add new types to `shared/src/types/team.ts`
   - Create `server/src/routes/members.ts`
   - Register route in `server/src/index.ts`

2. **Client-side API:**
   - Add API functions to `client/src/lib/api.ts`

3. **Store:**
   - Update `SidekickItemType` in `appStore.ts`

4. **Core App:**
   - Create `client/src/apps/members/` folder structure
   - Implement `MembersApp.tsx`
   - Implement `MembersApp.module.css`
   - Create `index.ts` barrel

5. **Sidekick:**
   - Create `client/src/features/sidekick/details/MemberDetail/`
   - Implement detail components
   - Update `Sidekick.tsx` to handle 'member' type

6. **Navigation:**
   - Update `Appbar.tsx`
   - Update `App.tsx` routes
   - Update `apps/index.ts`

7. **Optional Components:**
   - `InviteMemberModal` (if not reusing existing invite flow)

8. **Testing:**
   - Add E2E test `e2e/members.spec.ts`

---

## Future Enhancements

- **Activity Tab:** Show audit log entries related to the member
- **Bulk Actions:** Select multiple members for bulk role changes
- **Member Profiles:** Extended user profile view
- **Direct Invite:** Send email invitations directly (requires email service)
- **Permission Roles:** More granular roles beyond admin/member

