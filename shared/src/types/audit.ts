// Audit - Event tracking for security and compliance
export type AuditAction =
  | 'machine.create'
  | 'machine.update'
  | 'machine.destroy'
  | 'machine.reboot'
  | 'machine.start'
  | 'machine.stop'
  | 'service.restart'
  | 'service.stop'
  | 'provider.create'
  | 'provider.update'
  | 'provider.delete'
  | 'provider.verify'
  | 'credentials.create'
  | 'credentials.rotate'
  | 'credentials.revoke'
  | 'deployment.create'
  | 'deployment.cancel'
  | 'deployment.approve'
  | 'bootstrap.create'
  | 'bootstrap.update'
  | 'bootstrap.delete'
  | 'user.login'
  | 'user.logout';

export type AuditOutcome = 'success' | 'failure' | 'pending';

export interface AuditEvent {
  event_id: string;
  action: AuditAction;
  outcome: AuditOutcome;
  
  // Actor
  actor_id: string;
  actor_type: 'user' | 'system' | 'api_key';
  actor_name?: string;
  
  // Target
  target_type: 'machine' | 'provider' | 'deployment' | 'bootstrap' | 'service' | 'user';
  target_id: string;
  target_name?: string;
  
  // Context
  ip_address?: string;
  user_agent?: string;
  
  // Details (non-sensitive)
  details?: Record<string, unknown>;
  
  // Timestamp
  timestamp: string;
}

export interface AuditEventListFilter {
  action?: AuditAction;
  outcome?: AuditOutcome;
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  after?: string;
  before?: string;
}




