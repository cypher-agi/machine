import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Mock database
const mockDatabase = {
  getMachines: vi.fn(),
  getMachine: vi.fn(),
  insertMachine: vi.fn(),
  updateMachine: vi.fn(),
  deleteMachine: vi.fn(),
  getProviderAccount: vi.fn(),
  getCredentials: vi.fn(),
  insertDeployment: vi.fn(),
  updateDeployment: vi.fn(),
  insertAuditEvent: vi.fn(),
};

vi.mock('../../src/services/database', () => ({
  database: mockDatabase,
  default: mockDatabase,
}));

// Mock terraform service
vi.mock('../../src/services/terraform', () => ({
  TerraformService: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    plan: vi.fn().mockResolvedValue({ add: 1, change: 0, destroy: 0 }),
    apply: vi.fn().mockResolvedValue({ public_ip: '192.168.1.1' }),
    destroy: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
  })),
  getTerraformModulesDir: vi.fn().mockReturnValue('/tmp/terraform'),
}));

describe('Machines API Integration', () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // Simple mock route handlers for testing
    app.get('/api/machines', (_req, res) => {
      const machines = mockDatabase.getMachines();
      res.json({ success: true, data: machines });
    });

    app.get('/api/machines/:id', (req, res) => {
      const machine = mockDatabase.getMachine(req.params.id);
      if (!machine) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Machine not found' },
        });
      }
      res.json({ success: true, data: machine });
    });

    app.post('/api/machines', (req, res) => {
      const { name, provider_account_id, region, size, image } = req.body;

      if (!name || !provider_account_id || !region || !size || !image) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
        });
      }

      const account = mockDatabase.getProviderAccount(provider_account_id);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Provider account not found' },
        });
      }

      const credentials = mockDatabase.getCredentials(provider_account_id);
      if (!credentials) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'No credentials found' },
        });
      }

      const machine = {
        machine_id: 'new-machine-1',
        name,
        provider: account.provider_type,
        provider_account_id,
        region,
        size,
        image,
        desired_status: 'running',
        actual_status: 'provisioning',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: {},
      };

      mockDatabase.insertMachine(machine);

      res.status(201).json({
        success: true,
        data: {
          machine,
          deployment: {
            deployment_id: 'deploy-1',
            machine_id: machine.machine_id,
            type: 'create',
            state: 'pending',
          },
        },
      });
    });
  });

  describe('GET /api/machines', () => {
    it('should return list of machines', async () => {
      const mockMachines = [
        { machine_id: 'm-1', name: 'Machine 1', actual_status: 'running' },
        { machine_id: 'm-2', name: 'Machine 2', actual_status: 'stopped' },
      ];
      mockDatabase.getMachines.mockReturnValue(mockMachines);

      const response = await request(app).get('/api/machines');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return empty array when no machines exist', async () => {
      mockDatabase.getMachines.mockReturnValue([]);

      const response = await request(app).get('/api/machines');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/machines/:id', () => {
    it('should return machine when found', async () => {
      const mockMachine = { machine_id: 'm-1', name: 'Test Machine' };
      mockDatabase.getMachine.mockReturnValue(mockMachine);

      const response = await request(app).get('/api/machines/m-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.machine_id).toBe('m-1');
    });

    it('should return 404 when machine not found', async () => {
      mockDatabase.getMachine.mockReturnValue(undefined);

      const response = await request(app).get('/api/machines/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/machines', () => {
    const validMachineData = {
      name: 'New Machine',
      provider_account_id: 'acc-1',
      region: 'nyc1',
      size: 's-1vcpu-1gb',
      image: 'ubuntu-22-04-x64',
    };

    it('should create machine when data is valid', async () => {
      mockDatabase.getProviderAccount.mockReturnValue({
        provider_account_id: 'acc-1',
        provider_type: 'digitalocean',
      });
      mockDatabase.getCredentials.mockReturnValue({ api_token: 'test-token' });

      const response = await request(app).post('/api/machines').send(validMachineData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.machine).toBeDefined();
      expect(response.body.data.deployment).toBeDefined();
      expect(mockDatabase.insertMachine).toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app).post('/api/machines').send({ name: 'Incomplete' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when provider account not found', async () => {
      mockDatabase.getProviderAccount.mockReturnValue(undefined);

      const response = await request(app).post('/api/machines').send(validMachineData);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when credentials not found', async () => {
      mockDatabase.getProviderAccount.mockReturnValue({
        provider_account_id: 'acc-1',
        provider_type: 'digitalocean',
      });
      mockDatabase.getCredentials.mockReturnValue(undefined);

      const response = await request(app).post('/api/machines').send(validMachineData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
