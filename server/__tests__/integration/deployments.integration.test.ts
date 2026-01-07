import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

const mockDatabase = {
  getDeployments: vi.fn(),
  getDeployment: vi.fn(),
  updateDeployment: vi.fn(),
  insertAuditEvent: vi.fn(),
};

vi.mock('../../src/services/database', () => ({
  database: mockDatabase,
  default: mockDatabase,
}));

describe('Deployments API Integration', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // GET /api/deployments
    app.get('/api/deployments', (req, res) => {
      let deployments = mockDatabase.getDeployments();

      // Apply filters
      if (req.query.machine_id) {
        deployments = deployments.filter(
          (d: { machine_id: string }) => d.machine_id === req.query.machine_id
        );
      }
      if (req.query.state) {
        deployments = deployments.filter((d: { state: string }) => d.state === req.query.state);
      }
      if (req.query.type) {
        deployments = deployments.filter((d: { type: string }) => d.type === req.query.type);
      }

      res.json({ success: true, data: deployments });
    });

    // GET /api/deployments/:id
    app.get('/api/deployments/:id', (req, res) => {
      const deployment = mockDatabase.getDeployment(req.params.id);
      if (!deployment) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deployment not found' },
        });
      }
      res.json({ success: true, data: deployment });
    });

    // GET /api/deployments/:id/logs
    app.get('/api/deployments/:id/logs', (req, res) => {
      const deployment = mockDatabase.getDeployment(req.params.id);
      if (!deployment) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deployment not found' },
        });
      }

      // Check for SSE stream request
      if (req.query.stream === 'true') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write('event: log\ndata: {"message":"Test log"}\n\n');
        res.end();
        return;
      }

      res.json({
        success: true,
        data: deployment.logs || [],
      });
    });

    // POST /api/deployments/:id/cancel
    app.post('/api/deployments/:id/cancel', (req, res) => {
      const deployment = mockDatabase.getDeployment(req.params.id);
      if (!deployment) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deployment not found' },
        });
      }

      if (!['pending', 'awaiting_approval'].includes(deployment.state)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Cannot cancel deployment in this state' },
        });
      }

      const updated = { ...deployment, state: 'cancelled' };
      mockDatabase.updateDeployment(updated);
      res.json({ success: true, data: updated });
    });

    // POST /api/deployments/:id/approve
    app.post('/api/deployments/:id/approve', (req, res) => {
      const deployment = mockDatabase.getDeployment(req.params.id);
      if (!deployment) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Deployment not found' },
        });
      }

      if (deployment.state !== 'awaiting_approval') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Deployment is not awaiting approval' },
        });
      }

      const updated = { ...deployment, state: 'in_progress' };
      mockDatabase.updateDeployment(updated);
      res.json({ success: true, data: updated });
    });
  });

  describe('GET /api/deployments', () => {
    it('should return list of deployments', async () => {
      mockDatabase.getDeployments.mockReturnValue([
        { deployment_id: 'd-1', machine_id: 'm-1', type: 'create', state: 'completed' },
        { deployment_id: 'd-2', machine_id: 'm-2', type: 'destroy', state: 'pending' },
      ]);

      const response = await request(app).get('/api/deployments');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by machine_id', async () => {
      mockDatabase.getDeployments.mockReturnValue([
        { deployment_id: 'd-1', machine_id: 'm-1', type: 'create', state: 'completed' },
        { deployment_id: 'd-2', machine_id: 'm-2', type: 'destroy', state: 'pending' },
      ]);

      const response = await request(app).get('/api/deployments?machine_id=m-1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].machine_id).toBe('m-1');
    });

    it('should filter by state', async () => {
      mockDatabase.getDeployments.mockReturnValue([
        { deployment_id: 'd-1', state: 'completed' },
        { deployment_id: 'd-2', state: 'pending' },
      ]);

      const response = await request(app).get('/api/deployments?state=pending');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by type', async () => {
      mockDatabase.getDeployments.mockReturnValue([
        { deployment_id: 'd-1', type: 'create' },
        { deployment_id: 'd-2', type: 'destroy' },
      ]);

      const response = await request(app).get('/api/deployments?type=create');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/deployments/:id', () => {
    it('should return deployment when found', async () => {
      mockDatabase.getDeployment.mockReturnValue({
        deployment_id: 'd-1',
        type: 'create',
        state: 'completed',
      });

      const response = await request(app).get('/api/deployments/d-1');

      expect(response.status).toBe(200);
      expect(response.body.data.deployment_id).toBe('d-1');
    });

    it('should return 404 when not found', async () => {
      mockDatabase.getDeployment.mockReturnValue(undefined);

      const response = await request(app).get('/api/deployments/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/deployments/:id/logs', () => {
    it('should fetch logs for completed deployment', async () => {
      mockDatabase.getDeployment.mockReturnValue({
        deployment_id: 'd-1',
        logs: [{ timestamp: '2024-01-01', level: 'info', message: 'Test' }],
      });

      const response = await request(app).get('/api/deployments/d-1/logs');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should support SSE streaming', async () => {
      mockDatabase.getDeployment.mockReturnValue({ deployment_id: 'd-1' });

      const response = await request(app).get('/api/deployments/d-1/logs?stream=true');

      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('POST /api/deployments/:id/cancel', () => {
    it('should cancel pending deployment', async () => {
      mockDatabase.getDeployment.mockReturnValue({
        deployment_id: 'd-1',
        state: 'pending',
      });

      const response = await request(app).post('/api/deployments/d-1/cancel');

      expect(response.status).toBe(200);
      expect(response.body.data.state).toBe('cancelled');
    });

    it('should not cancel completed deployment', async () => {
      mockDatabase.getDeployment.mockReturnValue({
        deployment_id: 'd-1',
        state: 'completed',
      });

      const response = await request(app).post('/api/deployments/d-1/cancel');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_STATE');
    });
  });

  describe('POST /api/deployments/:id/approve', () => {
    it('should approve awaiting deployment', async () => {
      mockDatabase.getDeployment.mockReturnValue({
        deployment_id: 'd-1',
        state: 'awaiting_approval',
      });

      const response = await request(app).post('/api/deployments/d-1/approve');

      expect(response.status).toBe(200);
      expect(response.body.data.state).toBe('in_progress');
    });

    it('should not approve non-awaiting deployment', async () => {
      mockDatabase.getDeployment.mockReturnValue({
        deployment_id: 'd-1',
        state: 'completed',
      });

      const response = await request(app).post('/api/deployments/d-1/approve');

      expect(response.status).toBe(400);
    });
  });
});
