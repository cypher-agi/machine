// Team - Team management types

export type TeamRole = 'admin' | 'member';

export interface Team {
  team_id: string;
  name: string; // Display name
  handle: string; // Unique handle (like @username for teams)
  avatar_url?: string | undefined;
  created_at: string;
  updated_at: string;
  created_by: string; // user_id
}

export interface TeamMember {
  team_member_id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  invited_by?: string | undefined; // user_id
}

// Team with member info (for list views)
export interface TeamWithMembership extends Team {
  role: TeamRole;
  member_count: number;
}

// Team Invite
export interface TeamInvite {
  invite_id: string;
  team_id: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
  used_by?: string;
}

// Member with user info for detail views
export interface TeamMemberWithUser extends TeamMember {
  user: {
    user_id: string;
    display_name: string;
    email: string;
    profile_picture_url?: string | undefined;
  };
}

// API Request types
export interface CreateTeamRequest {
  name: string;
  handle: string;
}

export interface UpdateTeamRequest {
  name?: string;
  handle?: string;
}

// Handle availability check
export interface HandleAvailabilityResponse {
  handle: string;
  available: boolean;
  suggestion?: string; // Suggested alternative if not available
}

export interface JoinTeamRequest {
  invite_code: string;
}

export interface UpdateTeamMemberRequest {
  role: TeamRole;
}

// API Response types
export interface TeamDetailResponse {
  team: Team;
  members: TeamMemberWithUser[];
  pending_invites?: TeamInvite[] | undefined; // Only for admins
  current_user_role: TeamRole;
}
