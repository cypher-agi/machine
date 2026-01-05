import { Router, Request, Response } from 'express';
import { database } from '../services/database';
import { 
  Deployment, 
  DeploymentLog,
  DeploymentListFilter,
  ApiResponse
} from '@machine/shared';
import { AppError } from '../middleware/errorHandler';
import { addDeploymentLogListener, removeDeploymentLogListener } from './machines';

export const deploymentsRouter = Router();

// GET /deployments - List deployments with filtering
deploymentsRouter.get('/', (req: Request, res: Response) => {
  const filters: DeploymentListFilter = {
    machine_id: req.query.machine_id as string,
    type: req.query.type as any,
    state: req.query.state as any,
    created_after: req.query.created_after as string,
    created_before: req.query.created_before as string
  };

  let filtered = database.getDeployments();

  // Apply filters
  if (filters.machine_id) {
    filtered = filtered.filter(d => d.machine_id === filters.machine_id);
  }
  if (filters.type) {
    filtered = filtered.filter(d => d.type === filters.type);
  }
  if (filters.state) {
    filtered = filtered.filter(d => d.state === filters.state);
  }
  if (filters.created_after) {
    filtered = filtered.filter(d => new Date(d.created_at) >= new Date(filters.created_after!));
  }
  if (filters.created_before) {
    filtered = filtered.filter(d => new Date(d.created_at) <= new Date(filters.created_before!));
  }

  // Sort by created_at descending (most recent first)
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const perPage = Math.min(parseInt(req.query.per_page as string) || 20, 100);
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedDeployments = filtered.slice(startIndex, startIndex + perPage);

  const response: ApiResponse<Deployment[]> = {
    success: true,
    data: paginatedDeployments,
    meta: {
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      },
      timestamp: new Date().toISOString()
    }
  };

  res.json(response);
});

// GET /deployments/:id - Get single deployment
deploymentsRouter.get('/:id', (req: Request, res: Response) => {
  const deployment = database.getDeployment(req.params.id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${req.params.id} not found`);
  }

  const response: ApiResponse<Deployment> = {
    success: true,
    data: deployment
  };

  res.json(response);
});

// GET /deployments/:id/logs - Get deployment logs (supports SSE for streaming)
deploymentsRouter.get('/:id/logs', (req: Request, res: Response) => {
  const deployment = database.getDeployment(req.params.id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${req.params.id} not found`);
  }

  const stream = req.query.stream === 'true';

  if (stream) {
    // SSE streaming for live logs
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let logIndex = 0;

    // Send existing logs if any
    const logs = (deployment as any).logs || [];
    logs.forEach((log: any) => {
      res.write(`id: ${logIndex++}\n`);
      res.write(`event: log\n`);
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    // If deployment is complete, send end event
    if (!['queued', 'planning', 'applying'].includes(deployment.state)) {
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify({ state: deployment.state })}\n\n`);
      res.end();
    } else {
      // Register as a log listener for real-time updates
      const logListener = (log: any) => {
        res.write(`id: ${logIndex++}\n`);
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      };

      addDeploymentLogListener(req.params.id, logListener);

      // Poll for completion state
      const pollInterval = setInterval(() => {
        const updated = database.getDeployment(req.params.id);
        if (updated && !['queued', 'planning', 'applying'].includes(updated.state)) {
          res.write(`event: complete\n`);
          res.write(`data: ${JSON.stringify({ state: updated.state })}\n\n`);
          clearInterval(pollInterval);
          removeDeploymentLogListener(req.params.id, logListener);
          res.end();
        }
      }, 1000);

      req.on('close', () => {
        clearInterval(pollInterval);
        removeDeploymentLogListener(req.params.id, logListener);
      });
    }
  } else {
    // Regular JSON response
    const logs = (deployment as any).logs || [];

    const response: ApiResponse<DeploymentLog[]> = {
      success: true,
      data: logs.map((log: any) => ({
        deployment_id: deployment.deployment_id,
        ...log
      })) as DeploymentLog[]
    };

    res.json(response);
  }
});

// POST /deployments/:id/cancel - Cancel a running deployment
deploymentsRouter.post('/:id/cancel', (req: Request, res: Response) => {
  const deployment = database.getDeployment(req.params.id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${req.params.id} not found`);
  }

  if (!['queued', 'planning', 'applying'].includes(deployment.state)) {
    throw new AppError(400, 'INVALID_STATE', `Cannot cancel deployment in state: ${deployment.state}`);
  }

  database.updateDeployment({
    deployment_id: deployment.deployment_id,
    state: 'cancelled',
    finished_at: new Date().toISOString()
  });

  const updated = database.getDeployment(deployment.deployment_id);

  const response: ApiResponse<Deployment> = {
    success: true,
    data: updated!
  };

  res.json(response);
});

// POST /deployments/:id/approve - Approve a deployment awaiting approval
deploymentsRouter.post('/:id/approve', (req: Request, res: Response) => {
  const deployment = database.getDeployment(req.params.id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${req.params.id} not found`);
  }

  if (deployment.state !== 'awaiting_approval') {
    throw new AppError(400, 'INVALID_STATE', `Deployment is not awaiting approval`);
  }

  database.updateDeployment({
    deployment_id: deployment.deployment_id,
    state: 'applying',
    started_at: new Date().toISOString()
  });

  const updated = database.getDeployment(deployment.deployment_id);

  const response: ApiResponse<Deployment> = {
    success: true,
    data: updated!
  };

  res.json(response);
});
