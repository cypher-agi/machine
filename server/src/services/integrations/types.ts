import type {
  IntegrationType,
  IntegrationDefinition,
  TeamIntegration,
  SyncResponse,
} from '@machina/shared';

/**
 * Context for integration operations
 */
export interface IntegrationContext {
  teamId: string;
  userId: string;
  userName: string;
  userRole: 'admin' | 'member';
  ipAddress?: string;
}

/**
 * Abstract interface all integration services must implement
 */
export interface IntegrationService {
  /** The integration type this service handles */
  readonly type: IntegrationType;

  /** Integration metadata */
  readonly definition: IntegrationDefinition;

  // ============ Connection Lifecycle ============

  /**
   * Generate the OAuth/install URL for connecting
   */
  getConnectUrl(ctx: IntegrationContext): Promise<string>;

  /**
   * Get the URL where users can manage organization/repository access on the provider
   * (e.g., GitHub settings page for the OAuth app)
   */
  getManageAccessUrl(ctx: IntegrationContext): Promise<string>;

  /**
   * Handle the OAuth callback after user authorizes
   * Returns the created integration
   */
  handleCallback(ctx: IntegrationContext, params: Record<string, string>): Promise<TeamIntegration>;

  /**
   * Disconnect and cleanup
   */
  disconnect(ctx: IntegrationContext, integrationId: string): Promise<void>;

  // ============ Sync Operations ============

  /**
   * Trigger a sync operation
   */
  sync(ctx: IntegrationContext, integrationId: string): Promise<SyncResponse>;

  /**
   * Get current sync status
   */
  getSyncStatus(integrationId: string): Promise<{
    status: 'idle' | 'in_progress';
    progress?: number;
    last_sync_at?: string;
  }>;

  // ============ Validation ============

  /**
   * Verify the integration is still valid (token works, etc.)
   */
  verify(ctx: IntegrationContext, integrationId: string): Promise<boolean>;
}
