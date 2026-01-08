import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// Hoist mocks to the top
const mockDatabase = vi.hoisted(() => ({
  getTeamIntegration: vi.fn(),
  getTeamIntegrationById: vi.fn(),
  insertTeamIntegration: vi.fn(),
  updateTeamIntegration: vi.fn(),
  getOAuthConfig: vi.fn(),
  deleteOAuthConfig: vi.fn(),
  storeOAuthState: vi.fn(),
  getOAuthState: vi.fn(),
  deleteOAuthState: vi.fn(),
  getIntegrationCredentials: vi.fn(),
  storeIntegrationCredentials: vi.fn(),
  deleteIntegrationCredentials: vi.fn(),
  upsertGitHubRepository: vi.fn(),
  upsertGitHubMember: vi.fn(),
  markRemovedGitHubRepositories: vi.fn(),
  markRemovedGitHubMembersByIds: vi.fn(),
  markAllGitHubDataRemoved: vi.fn(),
  clearGitHubMembers: vi.fn(),
  insertAuditEvent: vi.fn(),
}));

const mockCredentialVault = vi.hoisted(() => ({
  encryptCredentials: vi.fn().mockReturnValue('encrypted-data'),
  decryptCredentials: vi.fn(),
  generateOAuthState: vi.fn().mockReturnValue('test-oauth-state-123'),
  validateOAuthState: vi.fn(),
}));

vi.mock('../database', () => ({
  database: mockDatabase,
  default: mockDatabase,
}));

vi.mock('../credentialVault', () => mockCredentialVault);

// Mock fetch
const mockFetch = vi.fn() as MockedFunction<typeof globalThis.fetch>;
globalThis.fetch = mockFetch;

// Import after mocking
import { GitHubIntegrationService } from './github';
import type { IntegrationContext } from './types';

describe('GitHubIntegrationService', () => {
  let service: GitHubIntegrationService;
  const ctx: IntegrationContext = {
    teamId: 'team_test123',
    userId: 'user_456',
    userName: 'testuser@example.com',
    userRole: 'admin',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitHubIntegrationService();

    // Default mock for OAuth config
    mockDatabase.getOAuthConfig.mockReturnValue({
      encrypted_credentials: 'encrypted-oauth-config',
    });

    mockCredentialVault.decryptCredentials.mockReturnValue({
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
    });
  });

  describe('type and definition', () => {
    it('should have correct type', () => {
      expect(service.type).toBe('github');
    });

    it('should have definition with required fields', () => {
      expect(service.definition).toBeDefined();
      expect(service.definition.type).toBe('github');
      expect(service.definition.name).toBeDefined();
    });
  });

  describe('getConnectUrl', () => {
    it('should generate valid OAuth URL', async () => {
      const url = await service.getConnectUrl(ctx);

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=');
      expect(url).toContain('scope=');
    });

    it('should include required scopes', async () => {
      const url = await service.getConnectUrl(ctx);

      expect(url).toContain('read:org');
      expect(url).toContain('repo');
    });

    it('should store OAuth state for validation', async () => {
      await service.getConnectUrl(ctx);

      expect(mockDatabase.storeOAuthState).toHaveBeenCalledWith(
        'test-oauth-state-123',
        ctx.teamId,
        ctx.userId,
        10 // TTL in minutes
      );
    });

    it('should throw when OAuth config is not found', async () => {
      mockDatabase.getOAuthConfig.mockReturnValue(null);

      await expect(service.getConnectUrl(ctx)).rejects.toThrow(
        'GitHub OAuth credentials are not configured'
      );
    });

    it('should throw and remove corrupt credentials on decrypt failure', async () => {
      mockCredentialVault.decryptCredentials.mockImplementation(() => {
        throw new Error('Decrypt failed');
      });

      await expect(service.getConnectUrl(ctx)).rejects.toThrow('credentials were corrupted');
      expect(mockDatabase.deleteOAuthConfig).toHaveBeenCalledWith(ctx.teamId, 'github');
    });
  });

  describe('getManageAccessUrl', () => {
    it('should return GitHub settings URL with client_id', async () => {
      const url = await service.getManageAccessUrl(ctx);

      expect(url).toContain('https://github.com/settings/connections/applications/');
      expect(url).toContain('test-client-id');
    });
  });

  describe('handleCallback', () => {
    const callbackParams = {
      state: 'valid-state-token',
      code: 'authorization-code',
    };

    beforeEach(() => {
      mockCredentialVault.validateOAuthState.mockReturnValue({
        teamId: ctx.teamId,
        userId: ctx.userId,
      });

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ access_token: 'gho_test_token' }),
      } as Response);

      // Mock user info
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          id: 12345,
          login: 'testuser',
          avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        }),
      } as Response);

      mockDatabase.getTeamIntegration.mockReturnValue(null);
    });

    it('should exchange code for access token', async () => {
      await service.handleCallback(ctx, callbackParams);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should create new integration on first connection', async () => {
      const result = await service.handleCallback(ctx, callbackParams);

      expect(mockDatabase.insertTeamIntegration).toHaveBeenCalled();
      expect(mockDatabase.storeIntegrationCredentials).toHaveBeenCalled();
      expect(result.status).toBe('active');
      expect(result.external_account_name).toBe('testuser');
    });

    it('should update existing integration on re-authorization', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue({
        integration_id: 'existing-int-id',
        team_id: ctx.teamId,
        type: 'github',
        status: 'active',
      });

      const result = await service.handleCallback(ctx, callbackParams);

      expect(mockDatabase.updateTeamIntegration).toHaveBeenCalled();
      expect(mockDatabase.insertTeamIntegration).not.toHaveBeenCalled();
      expect(result.integration_id).toBe('existing-int-id');
    });

    it('should throw when state is missing', async () => {
      await expect(service.handleCallback(ctx, { code: 'code' })).rejects.toThrow(
        'Missing OAuth state'
      );
    });

    it('should throw when state is invalid', async () => {
      mockCredentialVault.validateOAuthState.mockReturnValue(null);

      await expect(service.handleCallback(ctx, callbackParams)).rejects.toThrow(
        'Invalid or expired OAuth state'
      );
    });

    it('should throw when code is missing', async () => {
      await expect(service.handleCallback(ctx, { state: 'valid-state' })).rejects.toThrow(
        'Missing authorization code'
      );
    });

    it('should throw when token exchange fails', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired',
        }),
      } as Response);

      await expect(service.handleCallback(ctx, callbackParams)).rejects.toThrow(
        'incorrect or expired'
      );
    });

    it('should clean up OAuth state after callback', async () => {
      await service.handleCallback(ctx, callbackParams);

      expect(mockDatabase.deleteOAuthState).toHaveBeenCalledWith(callbackParams.state);
    });

    it('should log audit event', async () => {
      await service.handleCallback(ctx, callbackParams);

      expect(mockDatabase.insertAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.connected',
          outcome: 'success',
        })
      );
    });
  });

  describe('disconnect', () => {
    const integrationId = 'int_test123';

    beforeEach(() => {
      mockDatabase.getTeamIntegrationById.mockReturnValue({
        integration_id: integrationId,
        team_id: ctx.teamId,
        type: 'github',
        status: 'active',
        external_account_name: 'testuser',
      });
    });

    it('should mark integration as disconnected', async () => {
      await service.disconnect(ctx, integrationId);

      expect(mockDatabase.updateTeamIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          integration_id: integrationId,
          status: 'disconnected',
        })
      );
    });

    it('should delete credentials', async () => {
      await service.disconnect(ctx, integrationId);

      expect(mockDatabase.deleteIntegrationCredentials).toHaveBeenCalledWith(integrationId);
    });

    it('should mark all synced data as removed', async () => {
      await service.disconnect(ctx, integrationId);

      expect(mockDatabase.markAllGitHubDataRemoved).toHaveBeenCalledWith(integrationId);
    });

    it('should throw when integration not found', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue(null);

      await expect(service.disconnect(ctx, integrationId)).rejects.toThrow('Integration not found');
    });

    it('should throw when integration belongs to different team', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue({
        integration_id: integrationId,
        team_id: 'different-team',
      });

      await expect(service.disconnect(ctx, integrationId)).rejects.toThrow('Integration not found');
    });

    it('should log audit event', async () => {
      await service.disconnect(ctx, integrationId);

      expect(mockDatabase.insertAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.disconnected',
          outcome: 'success',
        })
      );
    });
  });

  describe('sync', () => {
    const integrationId = 'int_test123';

    beforeEach(() => {
      mockDatabase.getTeamIntegrationById.mockReturnValue({
        integration_id: integrationId,
        team_id: ctx.teamId,
        type: 'github',
        status: 'active',
      });

      mockDatabase.getIntegrationCredentials.mockReturnValue('encrypted-creds');
      mockCredentialVault.decryptCredentials.mockReturnValue({
        access_token: 'gho_test_token',
      });

      // Mock user repos API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: 'repo1',
            full_name: 'user/repo1',
            private: false,
            archived: false,
            disabled: false,
            default_branch: 'main',
            html_url: 'https://github.com/user/repo1',
          },
        ],
      } as Response);

      // Mock orgs API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ login: 'test-org' }],
      } as Response);

      // Mock org repos API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 2,
            name: 'org-repo',
            full_name: 'test-org/org-repo',
            private: true,
            archived: false,
            disabled: false,
            default_branch: 'main',
            html_url: 'https://github.com/test-org/org-repo',
          },
        ],
      } as Response);

      // Mock authenticated user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          login: 'testuser',
          avatar_url: 'https://avatars.githubusercontent.com/u/123',
          html_url: 'https://github.com/testuser',
        }),
      } as Response);

      // Mock orgs API (second call for members)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ login: 'test-org' }],
      } as Response);

      // Mock org members API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 456,
            login: 'orgmember',
            avatar_url: 'https://avatars.githubusercontent.com/u/456',
            html_url: 'https://github.com/orgmember',
          },
        ],
      } as Response);
    });

    it('should return sync result with item count', async () => {
      const result = await service.sync(ctx, integrationId);

      expect(result.success).toBe(true);
      expect(result.items_synced).toBeGreaterThan(0);
    });

    it('should mark sync in progress', async () => {
      await service.sync(ctx, integrationId);

      expect(mockDatabase.updateTeamIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          last_sync_status: 'in_progress',
        })
      );
    });

    it('should update sync status on success', async () => {
      await service.sync(ctx, integrationId);

      expect(mockDatabase.updateTeamIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          last_sync_status: 'success',
        })
      );
    });

    it('should upsert repositories', async () => {
      await service.sync(ctx, integrationId);

      expect(mockDatabase.upsertGitHubRepository).toHaveBeenCalled();
    });

    it('should upsert members', async () => {
      await service.sync(ctx, integrationId);

      expect(mockDatabase.upsertGitHubMember).toHaveBeenCalled();
    });

    it('should mark removed repositories', async () => {
      await service.sync(ctx, integrationId);

      expect(mockDatabase.markRemovedGitHubRepositories).toHaveBeenCalled();
    });

    it('should throw when integration not found', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue(null);

      await expect(service.sync(ctx, integrationId)).rejects.toThrow('Integration not found');
    });

    it('should throw when credentials not found', async () => {
      mockDatabase.getIntegrationCredentials.mockReturnValue(null);

      await expect(service.sync(ctx, integrationId)).rejects.toThrow('Credentials not found');
    });

    it('should update sync status on error', async () => {
      mockDatabase.getIntegrationCredentials.mockReturnValue(null);

      await expect(service.sync(ctx, integrationId)).rejects.toThrow();

      expect(mockDatabase.updateTeamIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          last_sync_status: 'error',
        })
      );
    });

    it('should log audit event on success', async () => {
      await service.sync(ctx, integrationId);

      expect(mockDatabase.insertAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'integration.synced',
          outcome: 'success',
        })
      );
    });
  });

  describe('getSyncStatus', () => {
    it('should return idle status when not syncing', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue({
        last_sync_status: 'success',
        last_sync_at: '2024-01-01T00:00:00Z',
      });

      const result = await service.getSyncStatus('int-1');

      expect(result.status).toBe('idle');
      expect(result.last_sync_at).toBe('2024-01-01T00:00:00Z');
    });

    it('should return in_progress status when syncing', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue({
        last_sync_status: 'in_progress',
      });

      const result = await service.getSyncStatus('int-1');

      expect(result.status).toBe('in_progress');
    });

    it('should throw when integration not found', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue(null);

      await expect(service.getSyncStatus('nonexistent')).rejects.toThrow('Integration not found');
    });
  });

  describe('verify', () => {
    const integrationId = 'int_test123';

    beforeEach(() => {
      // Clear all mock fetch calls before each verify test
      mockFetch.mockReset();

      mockDatabase.getTeamIntegrationById.mockReturnValue({
        integration_id: integrationId,
        team_id: ctx.teamId,
      });
      mockDatabase.getIntegrationCredentials.mockReturnValue('encrypted-creds');
      mockCredentialVault.decryptCredentials.mockReturnValue({
        access_token: 'gho_test_token',
      });
    });

    it('should return true for valid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123, login: 'testuser' }),
      } as Response);

      const result = await service.verify(ctx, integrationId);

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await service.verify(ctx, integrationId);

      expect(result).toBe(false);
    });

    it('should return false when integration not found', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue(null);

      const result = await service.verify(ctx, integrationId);

      expect(result).toBe(false);
    });

    it('should return false when credentials not found', async () => {
      mockDatabase.getIntegrationCredentials.mockReturnValue(null);

      const result = await service.verify(ctx, integrationId);

      expect(result).toBe(false);
    });

    it('should return false when team ID does not match', async () => {
      mockDatabase.getTeamIntegrationById.mockReturnValue({
        integration_id: integrationId,
        team_id: 'different-team',
      });

      const result = await service.verify(ctx, integrationId);

      expect(result).toBe(false);
    });

    it('should return false on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.verify(ctx, integrationId);

      expect(result).toBe(false);
    });
  });
});
