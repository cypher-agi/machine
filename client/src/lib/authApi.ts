import type {
  User,
  LoginRequest,
  LoginResponse,
  UpdateProfileRequest,
  Session,
} from '@machina/shared';

const API_BASE = '/api/auth';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get token from localStorage
  const authData = localStorage.getItem('auth-storage');
  let sessionToken: string | null = null;

  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      sessionToken = parsed.state?.sessionToken || null;
    } catch {
      // Ignore parse errors
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
      ...options?.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    const error = new Error(data.error?.message || 'An error occurred') as Error & {
      code?: string;
    };
    error.code = data.error?.code;
    throw error;
  }

  return data.data as T;
}

/**
 * Check auth status (public endpoint)
 */
export async function getAuthStatus(): Promise<{
  has_users: boolean;
  requires_setup: boolean;
  dev_mode: boolean;
}> {
  return fetchAuth('/status');
}

/**
 * Login with email and password
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  return fetchAuth<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Dev login (development only)
 */
export async function devLogin(): Promise<LoginResponse> {
  return fetchAuth<LoginResponse>('/dev-login', {
    method: 'POST',
  });
}

/**
 * Register a new user (first user only, or by admin)
 */
export async function register(data: {
  email: string;
  password: string;
  display_name: string;
}): Promise<LoginResponse> {
  return fetchAuth<LoginResponse>('/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Logout current session
 */
export async function logout(): Promise<void> {
  await fetchAuth<{ success: boolean }>('/logout', {
    method: 'POST',
  });
}

/**
 * Logout all sessions
 */
export async function logoutAll(): Promise<void> {
  await fetchAuth<{ success: boolean }>('/logout-all', {
    method: 'POST',
  });
}

/**
 * Get current user info
 */
export async function getMe(): Promise<User> {
  return fetchAuth<User>('/me');
}

/**
 * Update current user profile
 */
export async function updateMe(data: UpdateProfileRequest): Promise<User> {
  return fetchAuth<User>('/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Upload profile picture
 */
export async function uploadAvatar(file: File): Promise<User> {
  const authData = localStorage.getItem('auth-storage');
  let sessionToken: string | null = null;

  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      sessionToken = parsed.state?.sessionToken || null;
    } catch {
      // Ignore parse errors
    }
  }

  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${API_BASE}/me/avatar`, {
    method: 'POST',
    headers: {
      ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
    },
    body: formData,
  });

  const data: ApiResponse<User> = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to upload avatar');
  }

  return data.data as User;
}

/**
 * Delete profile picture
 */
export async function deleteAvatar(): Promise<User> {
  return fetchAuth<User>('/me/avatar', {
    method: 'DELETE',
  });
}

/**
 * Get user's sessions
 */
export async function getSessions(): Promise<Session[]> {
  return fetchAuth<Session[]>('/sessions');
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await fetchAuth<{ deleted: boolean }>(`/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}
