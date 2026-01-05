// API - Common response types and pagination
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  pagination?: PaginationMeta;
  timestamp?: string;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

// SSE Event types for real-time updates
export type SSEEventType = 
  | 'deployment.log'
  | 'deployment.state_change'
  | 'machine.status_change'
  | 'service.status_change'
  | 'agent.heartbeat';

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  timestamp: string;
  data: T;
}

// User and auth types
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  last_login?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expires_at: string;
}



