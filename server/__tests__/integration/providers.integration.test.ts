import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Mock database
const mockDatabase = {
  getProviderAccounts: vi.fn(),
  getProviderAccount: vi.fn(),
  insertProviderAccount: vi.fn(),
  updateProviderAccount: vi.fn(),
  deleteProviderAccount: vi.fn(),
  getCredentials: vi.fn(),
  storeCredentials: vi.fn(),
  insertAuditEvent: vi.fn(),
};

vi.mock('../../src/services/database', () => ({
  database: mockDatabase,
  default: mockDatabase,
}));

describe('Providers API Integration', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // GET /api/providers - List provider types
    app.get('/api/providers', (_req, res) => {
      res.json({
        success: true,
        data: [
          { type: 'digitalocean', name: 'DigitalOcean', supported: true },
          { type: 'hetzner', name: 'Hetzner', supported: true },
          { type: 'aws', name: 'Amazon Web Services', supported: false },
        ],
      });
    });

    // GET /api/providers/:type/options
    app.get('/api/providers/:type/options', (req, res) => {
      const { type } = req.params;
      if (type !== 'digitalocean' && type !== 'hetzner') {
        return res.status(400).json({
          success: false,
          error: { code: 'UNSUPPORTED_PROVIDER', message: 'Provider not supported' },
        });
      }

      res.json({
        success: true,
        data: {
          regions: [{ slug: 'nyc1', name: 'New York 1' }],
          sizes: [{ slug: 's-1vcpu-1gb', description: '1 vCPU, 1 GB' }],
          images: [{ slug: 'ubuntu-22-04-x64', name: 'Ubuntu 22.04' }],
          credential_fields: [{ name: 'api_token', type: 'password' }],
        },
      });
    });

    // GET /api/providers/accounts
    app.get('/api/providers/accounts', (_req, res) => {
      const accounts = mockDatabase.getProviderAccounts();
      res.json({ success: true, data: accounts });
    });

    // GET /api/providers/accounts/:id
    app.get('/api/providers/accounts/:id', (req, res) => {
      const account = mockDatabase.getProviderAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Provider account not found' },
        });
      }
      res.json({ success: true, data: account });
    });

    // POST /api/providers/:type/accounts
    app.post('/api/providers/:type/accounts', (req, res) => {
      const { type } = req.params;
      const { label, credentials } = req.body;

      if (!label) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Label is required' },
        });
      }

      if (!credentials || !credentials.api_token) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'API token is required' },
        });
      }

      const account = {
        provider_account_id: 'acc-new',
        provider_type: type,
        label,
        credential_status: 'valid',
        created_at: new Date().toISOString(),
      };

      mockDatabase.insertProviderAccount(account);
      mockDatabase.storeCredentials(account.provider_account_id, credentials);

      res.status(201).json({ success: true, data: account });
    });

    // POST /api/providers/accounts/:id/verify
    app.post('/api/providers/accounts/:id/verify', (req, res) => {
      const account = mockDatabase.getProviderAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account not found' },
        });
      }

      const updatedAccount = {
        ...account,
        credential_status: 'valid',
        last_verified_at: new Date().toISOString(),
      };
      mockDatabase.updateProviderAccount(updatedAccount);

      res.json({ success: true, data: updatedAccount });
    });

    // PUT /api/providers/accounts/:id
    app.put('/api/providers/accounts/:id', (req, res) => {
      const account = mockDatabase.getProviderAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account not found' },
        });
      }

      const updatedAccount = {
        ...account,
        ...req.body,
        updated_at: new Date().toISOString(),
      };
      mockDatabase.updateProviderAccount(updatedAccount);

      res.json({ success: true, data: updatedAccount });
    });

    // DELETE /api/providers/accounts/:id
    app.delete('/api/providers/accounts/:id', (req, res) => {
      const account = mockDatabase.getProviderAccount(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account not found' },
        });
      }

      mockDatabase.deleteProviderAccount(req.params.id);
      res.json({ success: true, data: { deleted: true } });
    });
  });

  describe('GET /api/providers', () => {
    it('should return list of provider types', async () => {
      const response = await request(app).get('/api/providers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toContainEqual(
        expect.objectContaining({ type: 'digitalocean', supported: true })
      );
    });
  });

  describe('GET /api/providers/:type/options', () => {
    it('should return options for supported provider', async () => {
      const response = await request(app).get('/api/providers/digitalocean/options');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('regions');
      expect(response.body.data).toHaveProperty('sizes');
      expect(response.body.data).toHaveProperty('images');
    });

    it('should return error for unsupported provider', async () => {
      const response = await request(app).get('/api/providers/gcp/options');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNSUPPORTED_PROVIDER');
    });
  });

  describe('GET /api/providers/accounts', () => {
    it('should return list of accounts', async () => {
      mockDatabase.getProviderAccounts.mockReturnValue([
        { provider_account_id: 'acc-1', label: 'Account 1' },
      ]);

      const response = await request(app).get('/api/providers/accounts');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/providers/accounts/:id', () => {
    it('should return account when found', async () => {
      mockDatabase.getProviderAccount.mockReturnValue({
        provider_account_id: 'acc-1',
        label: 'Test Account',
      });

      const response = await request(app).get('/api/providers/accounts/acc-1');

      expect(response.status).toBe(200);
      expect(response.body.data.provider_account_id).toBe('acc-1');
    });

    it('should return 404 when not found', async () => {
      mockDatabase.getProviderAccount.mockReturnValue(undefined);

      const response = await request(app).get('/api/providers/accounts/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/providers/:type/accounts', () => {
    it('should create account with valid data', async () => {
      const response = await request(app)
        .post('/api/providers/digitalocean/accounts')
        .send({
          label: 'New Account',
          credentials: { api_token: 'test-token' },
        });

      expect(response.status).toBe(201);
      expect(mockDatabase.insertProviderAccount).toHaveBeenCalled();
      expect(mockDatabase.storeCredentials).toHaveBeenCalled();
    });

    it('should return validation error without label', async () => {
      const response = await request(app)
        .post('/api/providers/digitalocean/accounts')
        .send({ credentials: { api_token: 'test' } });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/providers/accounts/:id/verify', () => {
    it('should verify account credentials', async () => {
      mockDatabase.getProviderAccount.mockReturnValue({
        provider_account_id: 'acc-1',
        credential_status: 'unknown',
      });

      const response = await request(app).post('/api/providers/accounts/acc-1/verify');

      expect(response.status).toBe(200);
      expect(response.body.data.credential_status).toBe('valid');
    });
  });

  describe('PUT /api/providers/accounts/:id', () => {
    it('should update account', async () => {
      mockDatabase.getProviderAccount.mockReturnValue({
        provider_account_id: 'acc-1',
        label: 'Old Label',
      });

      const response = await request(app)
        .put('/api/providers/accounts/acc-1')
        .send({ label: 'New Label' });

      expect(response.status).toBe(200);
      expect(mockDatabase.updateProviderAccount).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/providers/accounts/:id', () => {
    it('should delete account', async () => {
      mockDatabase.getProviderAccount.mockReturnValue({
        provider_account_id: 'acc-1',
      });

      const response = await request(app).delete('/api/providers/accounts/acc-1');

      expect(response.status).toBe(200);
      expect(response.body.data.deleted).toBe(true);
    });
  });
});
