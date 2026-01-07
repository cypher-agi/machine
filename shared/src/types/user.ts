// User - Authentication and authorization types

export type UserRole = 'admin' | 'user' | 'readonly';

export interface User {
  user_id: string;
  email: string;
  display_name: string;
  profile_picture_url?: string | undefined;
  role: UserRole;
  created_at: string;
  updated_at: string;
  last_login_at?: string | undefined;
}

export interface Session {
  session_id: string;
  user_id: string;
  ip_address?: string | undefined;
  user_agent?: string | undefined;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  is_current?: boolean | undefined;
}

// Auth requests/responses
export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
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

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
