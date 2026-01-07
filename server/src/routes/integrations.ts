import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
  ApiResponse,
  IntegrationType,
  IntegrationStatusResponse,
  IntegrationSetupInfo,
  IntegrationSetupRequest,
  IntegrationListItem,
} from '@machina/shared';
import { AppError } from '../middleware/errorHandler';
import { requireTeamAdmin } from '../middleware/auth';
import {
  getIntegrationService,
  isIntegrationSupported,
  INTEGRATION_DEFINITIONS,
  getIntegrationSetupInfo,
} from '../services/integrations/registry';
import { database } from '../services/database';
import { encryptCredentials } from '../services/credentialVault';

export const integrationsRouter = Router();

// ============ Generic Endpoints ============

// GET /integrations - List all available integrations
integrationsRouter.get('/', (req: Request, res: Response) => {
  const teamId = req.teamId ?? '';

  // Get all integration definitions
  const definitions = Object.values(INTEGRATION_DEFINITIONS);

  // Get team's active integrations
  const activeIntegrations = database.getTeamIntegrations(teamId);
  const activeTypes = new Set(activeIntegrations.map((i) => i.type));

  const integrations: IntegrationListItem[] = definitions.map((def) => ({
    ...def,
    connected: activeTypes.has(def.type),
    configured: database.hasOAuthConfig(teamId, def.type),
  }));

  const response: ApiResponse<IntegrationListItem[]> = {
    success: true,
    data: integrations,
  };

  res.json(response);
});

// ============ Type-Specific Endpoints ============

// Middleware to validate integration type (but don't check available - that's per-team now)
function validateIntegrationType(req: Request, _res: Response, next: NextFunction) {
  const { type } = req.params;

  if (!type || !isIntegrationSupported(type)) {
    return next(new AppError(400, 'INVALID_TYPE', `Unknown integration type: ${type}`));
  }

  next();
}

// GET /integrations/:type/setup - Get setup info for wizard
integrationsRouter.get('/:type/setup', validateIntegrationType, (req: Request, res: Response) => {
  const { type } = req.params as { type: IntegrationType };

  // Build callback URL - use the frontend origin (not backend API port)
  // In dev: requests come from localhost:5173 (vite), in prod: from the actual domain
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const forwardedHost = req.headers['x-forwarded-host'];
  const origin = req.headers['origin'];

  // Prefer origin header (set by browser), then forwarded host, then fall back to referer
  let host: string;
  if (origin) {
    // Origin is like "http://localhost:5173" - extract just the host:port
    try {
      const url = new URL(origin as string);
      host = url.host;
    } catch {
      host = (forwardedHost as string) || req.get('host') || 'localhost';
    }
  } else if (forwardedHost) {
    host = forwardedHost as string;
  } else {
    // Fall back - try to get from referer
    const referer = req.headers['referer'];
    if (referer) {
      try {
        const url = new URL(referer as string);
        host = url.host;
      } catch {
        host = req.get('host') || 'localhost';
      }
    } else {
      host = req.get('host') || 'localhost';
    }
  }

  const callbackUrl = `${protocol}://${host}/api/integrations/${type}/connect/callback`;

  const setupInfo = getIntegrationSetupInfo(type, callbackUrl);

  const response: ApiResponse<IntegrationSetupInfo> = {
    success: true,
    data: setupInfo,
  };

  res.json(response);
});

// POST /integrations/:type/configure - Save OAuth app credentials
integrationsRouter.post(
  '/:type/configure',
  validateIntegrationType,
  requireTeamAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId ?? '';
      const userId = req.user?.user_id ?? '';
      const { credentials } = req.body as IntegrationSetupRequest;

      if (!credentials) {
        throw new AppError(400, 'MISSING_CREDENTIALS', 'Credentials are required');
      }

      // Validate credentials based on type
      if (type === 'github') {
        if (!credentials.client_id || !credentials.client_secret) {
          throw new AppError(
            400,
            'INVALID_CREDENTIALS',
            'Client ID and Client Secret are required'
          );
        }
      }

      // Encrypt and store credentials
      // Use type as the binding ID (teamId is already used in key derivation)
      const configId = `cfg_${teamId}_${type}`;
      const encrypted = encryptCredentials(teamId, type, credentials);
      database.upsertOAuthConfig(configId, teamId, type, encrypted, userId);

      // Log audit event (non-blocking - don't fail if audit fails)
      try {
        database.insertAuditEvent({
          event_id: `evt_${uuidv4()}`,
          action: 'integration.configured',
          outcome: 'success',
          actor_id: userId,
          actor_type: 'user',
          actor_name: req.user?.email ?? '',
          target_type: 'integration_config',
          target_id: configId,
          target_name: type,
          timestamp: new Date().toISOString(),
          details: {
            integration_type: type,
          },
        });
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }

      const response: ApiResponse<{ configured: boolean }> = {
        success: true,
        data: { configured: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /integrations/:type/configure - Remove OAuth app credentials
integrationsRouter.delete(
  '/:type/configure',
  validateIntegrationType,
  requireTeamAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId ?? '';

      // Check if there's an active connection - must disconnect first
      const integration = database.getTeamIntegration(teamId, type);
      if (integration && integration.status === 'active') {
        throw new AppError(
          400,
          'ACTIVE_CONNECTION',
          'Must disconnect the integration before removing credentials'
        );
      }

      database.deleteOAuthConfig(teamId, type);

      const response: ApiResponse<{ removed: boolean }> = {
        success: true,
        data: { removed: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /integrations/:type/status - Get integration status
integrationsRouter.get('/:type/status', validateIntegrationType, (req: Request, res: Response) => {
  const { type } = req.params as { type: IntegrationType };
  const teamId = req.teamId ?? '';

  const service = getIntegrationService(type);
  const integration = database.getTeamIntegration(teamId, type);
  const configured = database.hasOAuthConfig(teamId, type);

  let stats: Record<string, number> | undefined;
  if (integration) {
    stats = database.getIntegrationStats(integration.integration_id);
  }

  const response: ApiResponse<IntegrationStatusResponse> = {
    success: true,
    data: {
      connected: !!integration && integration.status === 'active',
      configured,
      integration: integration || undefined,
      stats,
      definition: service.definition,
    },
  };

  res.json(response);
});

// GET /integrations/:type/connect/start - Start OAuth flow
integrationsRouter.get(
  '/:type/connect/start',
  validateIntegrationType,
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId ?? '';

      // Check if OAuth credentials are configured
      if (!database.hasOAuthConfig(teamId, type)) {
        throw new AppError(
          400,
          'NOT_CONFIGURED',
          `${type} OAuth credentials are not configured. Please configure the integration first.`
        );
      }

      const service = getIntegrationService(type);

      const url = await service.getConnectUrl({
        teamId,
        userId: req.user?.user_id ?? '',
        userName: req.user?.email ?? '',
        userRole: req.teamRole ?? 'member',
      });

      const response: ApiResponse<{ url: string }> = {
        success: true,
        data: { url },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /integrations/:type/manage-access - Get URL to manage organization access on provider
integrationsRouter.get(
  '/:type/manage-access',
  validateIntegrationType,
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId ?? '';

      // Check if OAuth credentials are configured
      if (!database.hasOAuthConfig(teamId, type)) {
        throw new AppError(400, 'NOT_CONFIGURED', `${type} OAuth credentials are not configured.`);
      }

      const service = getIntegrationService(type);

      const url = await service.getManageAccessUrl({
        teamId,
        userId: req.user?.user_id ?? '',
        userName: req.user?.email ?? '',
        userRole: req.teamRole ?? 'member',
      });

      const response: ApiResponse<{ url: string }> = {
        success: true,
        data: { url },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /integrations/:type/connect/callback - Handle OAuth callback
integrationsRouter.get(
  '/:type/connect/callback',
  validateIntegrationType,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const service = getIntegrationService(type);

      // Note: Callback may not have auth context, we validate via state
      await service.handleCallback(
        {
          teamId: req.teamId || '', // Will be validated from state
          userId: req.user?.user_id || '',
          userName: req.user?.email || '',
          userRole: 'admin',
        },
        req.query as Record<string, string>
      );

      // Redirect to integrations page
      res.redirect(`/integrations?connected=${type}`);
    } catch (error) {
      // Redirect with error
      const message = error instanceof Error ? error.message : 'Connection failed';
      res.redirect(`/integrations?error=${encodeURIComponent(message)}`);
    }
  }
);

// POST /integrations/:type/sync - Trigger sync
integrationsRouter.post(
  '/:type/sync',
  validateIntegrationType,
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId ?? '';

      const integration = database.getTeamIntegration(teamId, type);
      if (!integration) {
        throw new AppError(404, 'NOT_CONNECTED', `${type} is not connected`);
      }

      const service = getIntegrationService(type);
      const result = await service.sync(
        {
          teamId,
          userId: req.user?.user_id ?? '',
          userName: req.user?.email ?? '',
          userRole: req.teamRole ?? 'member',
        },
        integration.integration_id
      );

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /integrations/:type - Disconnect
integrationsRouter.delete(
  '/:type',
  validateIntegrationType,
  requireTeamAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params as { type: IntegrationType };
      const teamId = req.teamId ?? '';

      const integration = database.getTeamIntegration(teamId, type);
      if (!integration) {
        throw new AppError(404, 'NOT_CONNECTED', `${type} is not connected`);
      }

      const service = getIntegrationService(type);
      await service.disconnect(
        {
          teamId,
          userId: req.user?.user_id ?? '',
          userName: req.user?.email ?? '',
          userRole: req.teamRole ?? 'member',
        },
        integration.integration_id
      );

      const response: ApiResponse<{ disconnected: boolean }> = {
        success: true,
        data: { disconnected: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ============ GitHub-Specific Data Endpoints ============

// GET /integrations/github/repos - List repositories
integrationsRouter.get('/github/repos', (req: Request, res: Response) => {
  const teamId = req.teamId;
  if (!teamId) {
    res
      .status(400)
      .json({ success: false, error: { code: 'MISSING_TEAM', message: 'Team context required' } });
    return;
  }
  const { search, visibility, archived, sync_status } = req.query;

  const repos = database.getGitHubRepositories(teamId, {
    search: search as string | undefined,
    visibility: visibility as 'public' | 'private' | 'all' | undefined,
    archived: archived === 'true' ? true : undefined,
    sync_status: sync_status as 'ok' | 'error' | 'removed' | 'pending' | undefined,
  });

  const response: ApiResponse<typeof repos> = {
    success: true,
    data: repos,
  };

  res.json(response);
});

// GET /integrations/github/repos/:id
integrationsRouter.get('/github/repos/:id', (req: Request, res: Response, next: NextFunction) => {
  const teamId = req.teamId;
  if (!teamId) {
    return next(new AppError(400, 'MISSING_TEAM', 'Team context required'));
  }
  const { id } = req.params;

  const repo = database.getGitHubRepository(id, teamId);
  if (!repo) {
    return next(new AppError(404, 'NOT_FOUND', 'Repository not found'));
  }

  const response: ApiResponse<typeof repo> = {
    success: true,
    data: repo,
  };

  res.json(response);
});

// GET /integrations/github/members - List members
integrationsRouter.get('/github/members', (req: Request, res: Response) => {
  const teamId = req.teamId;
  if (!teamId) {
    res
      .status(400)
      .json({ success: false, error: { code: 'MISSING_TEAM', message: 'Team context required' } });
    return;
  }
  const { search, role, sync_status } = req.query;

  const members = database.getGitHubMembers(teamId, {
    search: search as string | undefined,
    role: role as 'admin' | 'member' | undefined,
    sync_status: sync_status as 'ok' | 'error' | 'removed' | 'pending' | undefined,
  });

  const response: ApiResponse<typeof members> = {
    success: true,
    data: members,
  };

  res.json(response);
});

// GET /integrations/github/members/:id
integrationsRouter.get('/github/members/:id', (req: Request, res: Response, next: NextFunction) => {
  const teamId = req.teamId;
  if (!teamId) {
    return next(new AppError(400, 'MISSING_TEAM', 'Team context required'));
  }
  const { id } = req.params;

  const member = database.getGitHubMember(id, teamId);
  if (!member) {
    return next(new AppError(404, 'NOT_FOUND', 'Member not found'));
  }

  const response: ApiResponse<typeof member> = {
    success: true,
    data: member,
  };

  res.json(response);
});

// ============ Public Callback Router (no auth required) ============

export const publicIntegrationCallbackRouter = Router();

// GET /integrations/:type/connect/callback - Handle OAuth callback (PUBLIC - no auth)
// This is called by GitHub after user authorizes - no session cookie present
publicIntegrationCallbackRouter.get(
  '/:type/connect/callback',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { type } = req.params;

      if (!type || !isIntegrationSupported(type)) {
        res.redirect(`/integrations?error=${encodeURIComponent('Invalid integration type')}`);
        return;
      }

      const service = getIntegrationService(type);

      // Callback validates via OAuth state - no auth context needed
      await service.handleCallback(
        {
          teamId: '', // Will be extracted from state
          userId: '',
          userName: '',
          userRole: 'admin',
        },
        req.query as Record<string, string>
      );

      // Redirect to integrations page with success
      res.redirect(`/integrations?connected=${type}`);
    } catch (error) {
      // Redirect with error
      const message = error instanceof Error ? error.message : 'Connection failed';
      res.redirect(`/integrations?error=${encodeURIComponent(message)}`);
    }
  }
);
