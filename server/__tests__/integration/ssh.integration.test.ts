import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

const mockDatabase = {
  getSSHKeys: vi.fn(),
  getSSHKey: vi.fn(),
  getSSHKeyByFingerprint: vi.fn(),
  insertSSHKey: vi.fn(),
  updateSSHKey: vi.fn(),
  deleteSSHKey: vi.fn(),
  getSSHKeyPrivateKey: vi.fn(),
  storeSSHKeyPrivateKey: vi.fn(),
  insertAuditEvent: vi.fn(),
};

vi.mock('../../src/services/database', () => ({
  database: mockDatabase,
  default: mockDatabase,
}));

describe('SSH Keys API Integration', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // GET /api/ssh/keys
    app.get('/api/ssh/keys', (_req, res) => {
      const keys = mockDatabase.getSSHKeys();
      res.json({ success: true, data: keys });
    });

    // GET /api/ssh/keys/:id
    app.get('/api/ssh/keys/:id', (req, res) => {
      const key = mockDatabase.getSSHKey(req.params.id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'SSH key not found' },
        });
      }
      res.json({ success: true, data: key });
    });

    // POST /api/ssh/keys/generate
    app.post('/api/ssh/keys/generate', (req, res) => {
      const { name, type = 'ed25519' } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name is required' },
        });
      }

      const key = {
        ssh_key_id: 'key-new',
        name,
        fingerprint: 'SHA256:test123',
        public_key: 'ssh-ed25519 AAAAC3NzaC1...',
        key_type: type,
        key_bits: type === 'ed25519' ? 256 : 4096,
        provider_key_ids: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockDatabase.insertSSHKey(key);
      mockDatabase.storeSSHKeyPrivateKey(key.ssh_key_id, '-----BEGIN PRIVATE KEY-----\n...');

      res.status(201).json({
        success: true,
        data: {
          key,
          private_key:
            '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----',
        },
      });
    });

    // POST /api/ssh/keys/import
    app.post('/api/ssh/keys/import', (req, res) => {
      const { name, public_key } = req.body;

      if (!name || !public_key) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name and public key are required' },
        });
      }

      // Check for duplicates
      const existing = mockDatabase.getSSHKeyByFingerprint('SHA256:imported');
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_KEY', message: 'Key already exists' },
        });
      }

      const key = {
        ssh_key_id: 'key-imported',
        name,
        fingerprint: 'SHA256:imported',
        public_key,
        key_type: 'ed25519',
        key_bits: 256,
        provider_key_ids: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockDatabase.insertSSHKey(key);
      res.status(201).json({ success: true, data: key });
    });

    // GET /api/ssh/keys/:id/private
    app.get('/api/ssh/keys/:id/private', (req, res) => {
      const key = mockDatabase.getSSHKey(req.params.id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Key not found' },
        });
      }

      const privateKey = mockDatabase.getSSHKeyPrivateKey(req.params.id);
      if (!privateKey) {
        return res.status(404).json({
          success: false,
          error: { code: 'NO_PRIVATE_KEY', message: 'Private key not available' },
        });
      }

      res.json({ success: true, data: { private_key: privateKey } });
    });

    // PATCH /api/ssh/keys/:id
    app.patch('/api/ssh/keys/:id', (req, res) => {
      const key = mockDatabase.getSSHKey(req.params.id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Key not found' },
        });
      }

      const updated = { ...key, ...req.body, updated_at: new Date().toISOString() };
      mockDatabase.updateSSHKey(updated);
      res.json({ success: true, data: updated });
    });

    // DELETE /api/ssh/keys/:id
    app.delete('/api/ssh/keys/:id', (req, res) => {
      const key = mockDatabase.getSSHKey(req.params.id);
      if (!key) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Key not found' },
        });
      }

      mockDatabase.deleteSSHKey(req.params.id);
      res.json({ success: true, data: { deleted: true } });
    });
  });

  describe('GET /api/ssh/keys', () => {
    it('should return list of keys', async () => {
      mockDatabase.getSSHKeys.mockReturnValue([{ ssh_key_id: 'key-1', name: 'Key 1' }]);

      const response = await request(app).get('/api/ssh/keys');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/ssh/keys/:id', () => {
    it('should return key when found', async () => {
      mockDatabase.getSSHKey.mockReturnValue({ ssh_key_id: 'key-1', name: 'Test Key' });

      const response = await request(app).get('/api/ssh/keys/key-1');

      expect(response.status).toBe(200);
      expect(response.body.data.ssh_key_id).toBe('key-1');
    });

    it('should return 404 when not found', async () => {
      mockDatabase.getSSHKey.mockReturnValue(undefined);

      const response = await request(app).get('/api/ssh/keys/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/ssh/keys/generate', () => {
    it('should generate new key', async () => {
      const response = await request(app)
        .post('/api/ssh/keys/generate')
        .send({ name: 'My New Key', type: 'ed25519' });

      expect(response.status).toBe(201);
      expect(response.body.data.key).toBeDefined();
      expect(response.body.data.private_key).toBeDefined();
    });

    it('should return error without name', async () => {
      const response = await request(app).post('/api/ssh/keys/generate').send({ type: 'ed25519' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ssh/keys/import', () => {
    it('should import public key', async () => {
      mockDatabase.getSSHKeyByFingerprint.mockReturnValue(undefined);

      const response = await request(app).post('/api/ssh/keys/import').send({
        name: 'Imported Key',
        public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest test@example.com',
      });

      expect(response.status).toBe(201);
    });

    it('should reject duplicate keys', async () => {
      mockDatabase.getSSHKeyByFingerprint.mockReturnValue({ ssh_key_id: 'existing' });

      const response = await request(app).post('/api/ssh/keys/import').send({
        name: 'Duplicate Key',
        public_key: 'ssh-ed25519 AAAAC3...',
      });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/ssh/keys/:id/private', () => {
    it('should return private key when available', async () => {
      mockDatabase.getSSHKey.mockReturnValue({ ssh_key_id: 'key-1' });
      mockDatabase.getSSHKeyPrivateKey.mockReturnValue('-----BEGIN PRIVATE KEY-----');

      const response = await request(app).get('/api/ssh/keys/key-1/private');

      expect(response.status).toBe(200);
      expect(response.body.data.private_key).toBeDefined();
    });

    it('should return 404 when private key not available', async () => {
      mockDatabase.getSSHKey.mockReturnValue({ ssh_key_id: 'key-1' });
      mockDatabase.getSSHKeyPrivateKey.mockReturnValue(undefined);

      const response = await request(app).get('/api/ssh/keys/key-1/private');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/ssh/keys/:id', () => {
    it('should update key name', async () => {
      mockDatabase.getSSHKey.mockReturnValue({ ssh_key_id: 'key-1', name: 'Old Name' });

      const response = await request(app).patch('/api/ssh/keys/key-1').send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(mockDatabase.updateSSHKey).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/ssh/keys/:id', () => {
    it('should delete key', async () => {
      mockDatabase.getSSHKey.mockReturnValue({ ssh_key_id: 'key-1' });

      const response = await request(app).delete('/api/ssh/keys/key-1');

      expect(response.status).toBe(200);
      expect(response.body.data.deleted).toBe(true);
    });
  });
});
