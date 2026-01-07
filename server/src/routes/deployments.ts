import { Router, type Request, type Response } from 'express';
import { database } from '../services/database';
import type { Deployment, DeploymentLog, DeploymentListFilter, ApiResponse } from '@machina/shared';
import { AppError } from '../middleware/errorHandler';
import { addDeploymentLogListener, removeDeploymentLogListener } from './machines';

export const deploymentsRouter = Router();

// GET /deployments - List deployments with filtering
deploymentsRouter.get('/', (req: Request, res: Response) => {
  const filters = {
    ...(req.query.machine_id && { machine_id: req.query.machine_id as string }),
    ...(req.query.type && { type: req.query.type as DeploymentListFilter['type'] }),
    ...(req.query.state && { state: req.query.state as DeploymentListFilter['state'] }),
    ...(req.query.created_after && { created_after: req.query.created_after as string }),
    ...(req.query.created_before && { created_before: req.query.created_before as string }),
  } as DeploymentListFilter;

  let filtered = database.getDeployments();

  // Apply filters
  if (filters.machine_id) {
    filtered = filtered.filter((d) => d.machine_id === filters.machine_id);
  }
  if (filters.type) {
    filtered = filtered.filter((d) => d.type === filters.type);
  }
  if (filters.state) {
    filtered = filtered.filter((d) => d.state === filters.state);
  }
  if (filters.created_after) {
    const afterDate = new Date(filters.created_after);
    filtered = filtered.filter((d) => new Date(d.created_at) >= afterDate);
  }
  if (filters.created_before) {
    const beforeDate = new Date(filters.created_before);
    filtered = filtered.filter((d) => new Date(d.created_at) <= beforeDate);
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
        has_prev: page > 1,
      },
      timestamp: new Date().toISOString(),
    },
  };

  res.json(response);
});

// GET /deployments/:id - Get single deployment
deploymentsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing deployment ID');
  }

  const deployment = database.getDeployment(id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${id} not found`);
  }

  const response: ApiResponse<Deployment> = {
    success: true,
    data: deployment,
  };

  res.json(response);
});

// GET /deployments/:id/logs - Get deployment logs (supports SSE for streaming)
deploymentsRouter.get('/:id/logs', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing deployment ID');
  }

  const deployment = database.getDeployment(id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${id} not found`);
  }

  const stream = req.query.stream === 'true';
  const rawLogs = deployment.logs;
  const logsArray: DeploymentLog[] = Array.isArray(rawLogs) ? rawLogs : [];

  if (stream) {
    // SSE streaming for live logs
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let logIndex = 0;

    // Send existing logs if any
    logsArray.forEach((log) => {
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
      const logListener = (log: { level: string; message: string; source: string }) => {
        res.write(`id: ${logIndex++}\n`);
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      };

      addDeploymentLogListener(id, logListener);

      // Poll for completion state
      const pollInterval = setInterval(() => {
        const updated = database.getDeployment(id);
        if (updated && !['queued', 'planning', 'applying'].includes(updated.state)) {
          res.write(`event: complete\n`);
          res.write(`data: ${JSON.stringify({ state: updated.state })}\n\n`);
          clearInterval(pollInterval);
          removeDeploymentLogListener(id, logListener);
          res.end();
        }
      }, 1000);

      req.on('close', () => {
        clearInterval(pollInterval);
        removeDeploymentLogListener(id, logListener);
      });
    }
  } else {
    // Regular JSON response
    const response: ApiResponse<DeploymentLog[]> = {
      success: true,
      data: logsArray.map((log) => ({
        ...log,
        deployment_id: deployment.deployment_id,
      })),
    };

    res.json(response);
  }
});

// POST /deployments/:id/cancel - Cancel a running deployment
deploymentsRouter.post('/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing deployment ID');
  }

  const deployment = database.getDeployment(id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${id} not found`);
  }

  if (!['queued', 'planning', 'applying'].includes(deployment.state)) {
    throw new AppError(
      400,
      'INVALID_STATE',
      `Cannot cancel deployment in state: ${deployment.state}`
    );
  }

  database.updateDeployment({
    deployment_id: deployment.deployment_id,
    state: 'cancelled',
    finished_at: new Date().toISOString(),
  });

  const updated = database.getDeployment(deployment.deployment_id);

  if (!updated) {
    throw new AppError(500, 'UPDATE_FAILED', 'Failed to retrieve updated deployment');
  }

  const response: ApiResponse<Deployment> = {
    success: true,
    data: updated,
  };

  res.json(response);
});

// POST /deployments/:id/approve - Approve a deployment awaiting approval
deploymentsRouter.post('/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing deployment ID');
  }

  const deployment = database.getDeployment(id);

  if (!deployment) {
    throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', `Deployment ${id} not found`);
  }

  if (deployment.state !== 'awaiting_approval') {
    throw new AppError(400, 'INVALID_STATE', `Deployment is not awaiting approval`);
  }

  database.updateDeployment({
    deployment_id: deployment.deployment_id,
    state: 'applying',
    started_at: new Date().toISOString(),
  });

  const updated = database.getDeployment(deployment.deployment_id);

  if (!updated) {
    throw new AppError(500, 'UPDATE_FAILED', 'Failed to retrieve updated deployment');
  }

  const response: ApiResponse<Deployment> = {
    success: true,
    data: updated,
  };

  res.json(response);
});
