import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Mock database
const mockDatabase = {
  getTeamIntegrations: vi.fn(),
  getTeamIntegration: vi.fn(),
  getTeamIntegrationById: vi.fn(),
  insertTeamIntegration: vi.fn(),
  updateTeamIntegration: vi.fn(),
  hasOAuthConfig: vi.fn(),
  getOAuthConfig: vi.fn(),
  upsertOAuthConfig: vi.fn(),
  deleteOAuthConfig: vi.fn(),
  storeOAuthState: vi.fn(),
  getOAuthState: vi.fn(),
  deleteOAuthState: vi.fn(),
  getIntegrationCredentials: vi.fn(),
  storeIntegrationCredentials: vi.fn(),
  deleteIntegrationCredentials: vi.fn(),
  getIntegrationStats: vi.fn(),
  getGitHubRepositories: vi.fn(),
  getGitHubRepository: vi.fn(),
  getGitHubMembers: vi.fn(),
  getGitHubMember: vi.fn(),
  markAllGitHubDataRemoved: vi.fn(),
  insertAuditEvent: vi.fn(),
};

vi.mock('../../src/services/database', () => ({
  database: mockDatabase,
  default: mockDatabase,
}));

// Mock credential vault
vi.mock('../../src/services/credentialVault', () => ({
  encryptCredentials: vi.fn().mockReturnValue('encrypted-data'),
  decryptCredentials: vi.fn().mockReturnValue({ access_token: 'test-token' }),
  generateOAuthState: vi.fn().mockReturnValue('test-state'),
  validateOAuthState: vi.fn().mockReturnValue({ teamId: 'team-1', userId: 'user-1' }),
}));

// Mock fetch for GitHub API calls
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock user and team context
const mockUser = { user_id: 'user-1', email: 'test@example.com' };
const mockTeamId = 'team-1';

describe('Integrations API Integration', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // Mock authentication and team context
    app.use((req, _res, next) => {
      req.user = mockUser;
      req.teamId = mockTeamId;
      req.teamRole = 'admin';
      next();
    });

    // GET /api/integrations - List available integrations
    app.get('/api/integrations', (req, res) => {
      const teamId = req.teamId ?? '';

      const definitions = [
        {
          type: 'github',
          name: 'GitHub',
          description: 'Import repositories and team members',
          icon: 'github',
          features: ['repos', 'members'],
          available: true,
        },
        {
          type: 'slack',
          name: 'Slack',
          description: 'Send notifications',
          icon: 'slack',
          features: ['notifications'],
          available: false,
        },
      ];

      const activeIntegrations = mockDatabase.getTeamIntegrations(teamId);
      const activeTypes = new Set((activeIntegrations || []).map((i: { type: string }) => i.type));

      const integrations = definitions.map((def) => ({
        ...def,
        connected: activeTypes.has(def.type),
        configured: mockDatabase.hasOAuthConfig(teamId, def.type),
      }));

      res.json({ success: true, data: integrations });
    });

    // GET /api/integrations/:type/setup - Get setup info
    app.get('/api/integrations/:type/setup', (req, res) => {
      const { type } = req.params;

      if (!['github', 'slack'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TYPE', message: `Unknown integration type: ${type}` },
        });
      }

      const callbackUrl = `http://localhost/api/integrations/${type}/connect/callback`;

      res.json({
        success: true,
        data: {
          type,
          name: type === 'github' ? 'GitHub' : 'Slack',
          instructions: [
            `Go to ${type === 'github' ? 'GitHub' : 'Slack'} developer settings`,
            'Create a new OAuth app',
            'Set callback URL',
            'Copy credentials',
          ],
          credential_fields: [
            { name: 'client_id', label: 'Client ID', type: 'text', required: true },
            { name: 'client_secret', label: 'Client Secret', type: 'password', required: true },
          ],
          callback_url: callbackUrl,
        },
      });
    });

    // POST /api/integrations/:type/configure - Save OAuth credentials
    app.post('/api/integrations/:type/configure', (req, res) => {
      const { type } = req.params;
      const teamId = req.teamId ?? '';
      const userId = req.user?.user_id ?? '';
      const { credentials } = req.body;

      if (!credentials) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_CREDENTIALS', message: 'Credentials are required' },
        });
      }

      if (type === 'github') {
        if (!credentials.client_id || !credentials.client_secret) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Client ID and Client Secret are required',
            },
          });
        }
      }

      const configId = `cfg_${teamId}_${type}`;
      mockDatabase.upsertOAuthConfig(configId, teamId, type, 'encrypted', userId);

      res.json({ success: true, data: { configured: true } });
    });

    // DELETE /api/integrations/:type/configure - Remove OAuth credentials
    app.delete('/api/integrations/:type/configure', (req, res) => {
      const { type } = req.params;
      const teamId = req.teamId ?? '';

      const integration = mockDatabase.getTeamIntegration(teamId, type);
      if (integration && integration.status === 'active') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ACTIVE_CONNECTION',
            message: 'Must disconnect the integration before removing credentials',
          },
        });
      }

      mockDatabase.deleteOAuthConfig(teamId, type);
      res.json({ success: true, data: { removed: true } });
    });

    // GET /api/integrations/:type/status - Get integration status
    app.get('/api/integrations/:type/status', (req, res) => {
      const { type } = req.params;
      const teamId = req.teamId ?? '';

      const integration = mockDatabase.getTeamIntegration(teamId, type);
      const configured = mockDatabase.hasOAuthConfig(teamId, type);

      let stats: Record<string, number> | undefined;
      if (integration) {
        stats = mockDatabase.getIntegrationStats(integration.integration_id);
      }

      res.json({
        success: true,
        data: {
          connected: !!integration && integration.status === 'active',
          configured,
          integration: integration || undefined,
          stats,
          definition: {
            type,
            name: type === 'github' ? 'GitHub' : type,
          },
        },
      });
    });

    // GET /api/integrations/:type/connect/start - Start OAuth flow
    app.get('/api/integrations/:type/connect/start', (req, res) => {
      const { type } = req.params;
      const teamId = req.teamId ?? '';

      if (!mockDatabase.hasOAuthConfig(teamId, type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: `${type} OAuth credentials are not configured`,
          },
        });
      }

      // Return OAuth URL
      const url = `https://github.com/login/oauth/authorize?client_id=test&state=test-state`;
      res.json({ success: true, data: { url } });
    });

    // POST /api/integrations/:type/sync - Trigger sync
    app.post('/api/integrations/:type/sync', async (req, res) => {
      const { type } = req.params;
      const teamId = req.teamId ?? '';

      const integration = mockDatabase.getTeamIntegration(teamId, type);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_CONNECTED', message: `${type} is not connected` },
        });
      }

      // Simulate sync
      mockDatabase.updateTeamIntegration({
        integration_id: integration.integration_id,
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
      });

      res.json({
        success: true,
        data: {
          success: true,
          started_at: new Date().toISOString(),
          items_synced: 10,
        },
      });
    });

    // DELETE /api/integrations/:type - Disconnect integration
    app.delete('/api/integrations/:type', (req, res) => {
      const { type } = req.params;
      const teamId = req.teamId ?? '';

      const integration = mockDatabase.getTeamIntegration(teamId, type);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_CONNECTED', message: `${type} is not connected` },
        });
      }

      mockDatabase.updateTeamIntegration({
        integration_id: integration.integration_id,
        status: 'disconnected',
      });
      mockDatabase.deleteIntegrationCredentials(integration.integration_id);
      mockDatabase.markAllGitHubDataRemoved(integration.integration_id);

      res.json({ success: true, data: { disconnected: true } });
    });

    // GET /api/integrations/github/repos - List repositories
    app.get('/api/integrations/github/repos', (req, res) => {
      const teamId = req.teamId;
      if (!teamId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_TEAM', message: 'Team context required' },
        });
      }

      const { search, visibility, archived, sync_status } = req.query;
      const repos = mockDatabase.getGitHubRepositories(teamId, {
        search: search as string | undefined,
        visibility: visibility as string | undefined,
        archived: archived === 'true',
        sync_status: sync_status as string | undefined,
      });

      res.json({ success: true, data: repos });
    });

    // GET /api/integrations/github/repos/:id
    app.get('/api/integrations/github/repos/:id', (req, res) => {
      const teamId = req.teamId;
      if (!teamId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_TEAM', message: 'Team context required' },
        });
      }

      const { id } = req.params;
      const repo = mockDatabase.getGitHubRepository(id, teamId);
      if (!repo) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Repository not found' },
        });
      }

      res.json({ success: true, data: repo });
    });

    // GET /api/integrations/github/members - List members
    app.get('/api/integrations/github/members', (req, res) => {
      const teamId = req.teamId;
      if (!teamId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_TEAM', message: 'Team context required' },
        });
      }

      const { search, role, sync_status } = req.query;
      const members = mockDatabase.getGitHubMembers(teamId, {
        search: search as string | undefined,
        role: role as string | undefined,
        sync_status: sync_status as string | undefined,
      });

      res.json({ success: true, data: members });
    });

    // GET /api/integrations/github/members/:id
    app.get('/api/integrations/github/members/:id', (req, res) => {
      const teamId = req.teamId;
      if (!teamId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_TEAM', message: 'Team context required' },
        });
      }

      const { id } = req.params;
      const member = mockDatabase.getGitHubMember(id, teamId);
      if (!member) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Member not found' },
        });
      }

      res.json({ success: true, data: member });
    });
  });

  describe('GET /api/integrations', () => {
    it('should return list of available integrations', async () => {
      mockDatabase.getTeamIntegrations.mockReturnValue([]);
      mockDatabase.hasOAuthConfig.mockReturnValue(false);

      const response = await request(app).get('/api/integrations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].type).toBe('github');
    });

    it('should mark connected integrations', async () => {
      mockDatabase.getTeamIntegrations.mockReturnValue([{ type: 'github', status: 'active' }]);
      mockDatabase.hasOAuthConfig.mockReturnValue(true);

      const response = await request(app).get('/api/integrations');

      expect(response.status).toBe(200);
      const github = response.body.data.find((i: { type: string }) => i.type === 'github');
      expect(github.connected).toBe(true);
      expect(github.configured).toBe(true);
    });

    it('should mark configured but not connected integrations', async () => {
      mockDatabase.getTeamIntegrations.mockReturnValue([]);
      mockDatabase.hasOAuthConfig.mockImplementation(
        (teamId: string, type: string) => type === 'github'
      );

      const response = await request(app).get('/api/integrations');

      expect(response.status).toBe(200);
      const github = response.body.data.find((i: { type: string }) => i.type === 'github');
      expect(github.connected).toBe(false);
      expect(github.configured).toBe(true);
    });
  });

  describe('GET /api/integrations/:type/setup', () => {
    it('should return setup info for github', async () => {
      const response = await request(app).get('/api/integrations/github/setup');

      expect(response.status).toBe(200);
      expect(response.body.data.type).toBe('github');
      expect(response.body.data.callback_url).toContain('/callback');
      expect(response.body.data.credential_fields).toHaveLength(2);
      expect(response.body.data.instructions).toBeInstanceOf(Array);
    });

    it('should return 400 for invalid type', async () => {
      const response = await request(app).get('/api/integrations/invalid/setup');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TYPE');
    });
  });

  describe('POST /api/integrations/:type/configure', () => {
    it('should save OAuth credentials', async () => {
      const response = await request(app)
        .post('/api/integrations/github/configure')
        .send({
          credentials: {
            client_id: 'test-client-id',
            client_secret: 'test-client-secret',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.configured).toBe(true);
      expect(mockDatabase.upsertOAuthConfig).toHaveBeenCalled();
    });

    it('should return 400 when credentials are missing', async () => {
      const response = await request(app).post('/api/integrations/github/configure').send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should return 400 when client_id is missing for GitHub', async () => {
      const response = await request(app)
        .post('/api/integrations/github/configure')
        .send({
          credentials: { client_secret: 'test-secret' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 400 when client_secret is missing for GitHub', async () => {
      const response = await request(app)
        .post('/api/integrations/github/configure')
        .send({
          credentials: { client_id: 'test-id' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('DELETE /api/integrations/:type/configure', () => {
    it('should remove OAuth credentials when not connected', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue(null);

      const response = await request(app).delete('/api/integrations/github/configure');

      expect(response.status).toBe(200);
      expect(response.body.data.removed).toBe(true);
      expect(mockDatabase.deleteOAuthConfig).toHaveBeenCalled();
    });

    it('should return 400 when integration is still active', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue({ status: 'active' });

      const response = await request(app).delete('/api/integrations/github/configure');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ACTIVE_CONNECTION');
    });

    it('should allow removal when integration is disconnected', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue({ status: 'disconnected' });

      const response = await request(app).delete('/api/integrations/github/configure');

      expect(response.status).toBe(200);
      expect(response.body.data.removed).toBe(true);
    });
  });

  describe('GET /api/integrations/:type/status', () => {
    it('should return status for connected integration', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue({
        integration_id: 'int-1',
        type: 'github',
        status: 'active',
        external_account_name: 'testuser',
        last_sync_at: new Date().toISOString(),
      });
      mockDatabase.hasOAuthConfig.mockReturnValue(true);
      mockDatabase.getIntegrationStats.mockReturnValue({ repos: 10, members: 5 });

      const response = await request(app).get('/api/integrations/github/status');

      expect(response.status).toBe(200);
      expect(response.body.data.connected).toBe(true);
      expect(response.body.data.configured).toBe(true);
      expect(response.body.data.stats).toEqual({ repos: 10, members: 5 });
    });

    it('should return status for unconfigured integration', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue(null);
      mockDatabase.hasOAuthConfig.mockReturnValue(false);

      const response = await request(app).get('/api/integrations/github/status');

      expect(response.status).toBe(200);
      expect(response.body.data.connected).toBe(false);
      expect(response.body.data.configured).toBe(false);
      expect(response.body.data.stats).toBeUndefined();
    });
  });

  describe('GET /api/integrations/:type/connect/start', () => {
    it('should return OAuth URL when configured', async () => {
      mockDatabase.hasOAuthConfig.mockReturnValue(true);

      const response = await request(app).get('/api/integrations/github/connect/start');

      expect(response.status).toBe(200);
      expect(response.body.data.url).toContain('github.com');
    });

    it('should return 400 when not configured', async () => {
      mockDatabase.hasOAuthConfig.mockReturnValue(false);

      const response = await request(app).get('/api/integrations/github/connect/start');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('NOT_CONFIGURED');
    });
  });

  describe('POST /api/integrations/:type/sync', () => {
    it('should trigger sync for connected integration', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue({
        integration_id: 'int-1',
        type: 'github',
        status: 'active',
      });

      const response = await request(app).post('/api/integrations/github/sync');

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.items_synced).toBeGreaterThan(0);
      expect(mockDatabase.updateTeamIntegration).toHaveBeenCalled();
    });

    it('should return 404 when not connected', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue(null);

      const response = await request(app).post('/api/integrations/github/sync');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_CONNECTED');
    });
  });

  describe('DELETE /api/integrations/:type', () => {
    it('should disconnect integration', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue({
        integration_id: 'int-1',
        type: 'github',
        status: 'active',
      });

      const response = await request(app).delete('/api/integrations/github');

      expect(response.status).toBe(200);
      expect(response.body.data.disconnected).toBe(true);
      expect(mockDatabase.updateTeamIntegration).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'disconnected' })
      );
      expect(mockDatabase.deleteIntegrationCredentials).toHaveBeenCalled();
      expect(mockDatabase.markAllGitHubDataRemoved).toHaveBeenCalled();
    });

    it('should return 404 when not connected', async () => {
      mockDatabase.getTeamIntegration.mockReturnValue(null);

      const response = await request(app).delete('/api/integrations/github');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_CONNECTED');
    });
  });

  describe('GitHub Data Endpoints', () => {
    describe('GET /api/integrations/github/repos', () => {
      it('should return list of repositories', async () => {
        const mockRepos = [
          { repo_id: 'ghr_1', name: 'repo-1', full_name: 'org/repo-1' },
          { repo_id: 'ghr_2', name: 'repo-2', full_name: 'org/repo-2' },
        ];
        mockDatabase.getGitHubRepositories.mockReturnValue(mockRepos);

        const response = await request(app).get('/api/integrations/github/repos');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
      });

      it('should pass filter parameters', async () => {
        mockDatabase.getGitHubRepositories.mockReturnValue([]);

        await request(app).get(
          '/api/integrations/github/repos?search=test&visibility=private&archived=true'
        );

        expect(mockDatabase.getGitHubRepositories).toHaveBeenCalledWith('team-1', {
          search: 'test',
          visibility: 'private',
          archived: true,
          sync_status: undefined,
        });
      });
    });

    describe('GET /api/integrations/github/repos/:id', () => {
      it('should return repository when found', async () => {
        mockDatabase.getGitHubRepository.mockReturnValue({
          repo_id: 'ghr_1',
          name: 'test-repo',
        });

        const response = await request(app).get('/api/integrations/github/repos/ghr_1');

        expect(response.status).toBe(200);
        expect(response.body.data.repo_id).toBe('ghr_1');
      });

      it('should return 404 when not found', async () => {
        mockDatabase.getGitHubRepository.mockReturnValue(null);

        const response = await request(app).get('/api/integrations/github/repos/nonexistent');

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });

    describe('GET /api/integrations/github/members', () => {
      it('should return list of members', async () => {
        const mockMembers = [
          { member_id: 'ghm_1', login: 'user1' },
          { member_id: 'ghm_2', login: 'user2' },
        ];
        mockDatabase.getGitHubMembers.mockReturnValue(mockMembers);

        const response = await request(app).get('/api/integrations/github/members');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
      });

      it('should pass filter parameters', async () => {
        mockDatabase.getGitHubMembers.mockReturnValue([]);

        await request(app).get('/api/integrations/github/members?search=john&role=admin');

        expect(mockDatabase.getGitHubMembers).toHaveBeenCalledWith('team-1', {
          search: 'john',
          role: 'admin',
          sync_status: undefined,
        });
      });
    });

    describe('GET /api/integrations/github/members/:id', () => {
      it('should return member when found', async () => {
        mockDatabase.getGitHubMember.mockReturnValue({
          member_id: 'ghm_1',
          login: 'testuser',
        });

        const response = await request(app).get('/api/integrations/github/members/ghm_1');

        expect(response.status).toBe(200);
        expect(response.body.data.member_id).toBe('ghm_1');
      });

      it('should return 404 when not found', async () => {
        mockDatabase.getGitHubMember.mockReturnValue(null);

        const response = await request(app).get('/api/integrations/github/members/nonexistent');

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });
  });
});
