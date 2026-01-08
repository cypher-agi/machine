import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

import { machinesRouter } from './routes/machines';
import { providersRouter } from './routes/providers';
import { deploymentsRouter } from './routes/deployments';
import { bootstrapRouter } from './routes/bootstrap';
import { auditRouter } from './routes/audit';
import { agentRouter } from './routes/agent';
import { sshRouter } from './routes/ssh';
import { authRouter } from './routes/auth';
import { teamsRouter } from './routes/teams';
import { membersRouter } from './routes/members';
import { integrationsRouter } from './routes/integrations';
import { repositoriesRouter } from './routes/repositories';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth, requireTeamContext } from './middleware/auth';
import { setupTerminalWebSocket } from './services/terminal';
import { getTerraformModulesDir, isTerraformAvailable } from './services/terraform';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version at startup
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { version: string };

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// Rate limiting for dangerous actions
const dangerousActionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});

// Body parsing
app.use(express.json());

// Health check
app.get('/health', (_, res) => {
  const modulesDir = getTerraformModulesDir();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    git_sha: process.env.GIT_SHA || null,
    terraform: {
      available: isTerraformAvailable(),
      modules_dir: modulesDir,
    },
  });
});

// Auth routes (public - handles its own auth)
app.use('/api/auth', authRouter);

// Public OAuth callback routes (no auth required - validated via state parameter)
import { publicIntegrationCallbackRouter } from './routes/integrations';
app.use('/api/integrations', publicIntegrationCallbackRouter);

// Protected API routes - require authentication and team context
// These routes filter data by team and enforce team membership
app.use('/api/machines', requireAuth, requireTeamContext, machinesRouter);
app.use('/api/providers', requireAuth, requireTeamContext, providersRouter);
app.use('/api/deployments', requireAuth, requireTeamContext, deploymentsRouter);
app.use('/api/bootstrap', requireAuth, requireTeamContext, bootstrapRouter);
app.use('/api/ssh', requireAuth, requireTeamContext, sshRouter);
app.use('/api/integrations', requireAuth, requireTeamContext, integrationsRouter);
app.use('/api/repositories', requireAuth, requireTeamContext, repositoriesRouter);
app.use('/api/members', membersRouter); // Has own auth handling

// Protected routes without team context (global resources)
app.use('/api/audit', requireAuth, auditRouter);
app.use('/api/teams', teamsRouter); // Has own auth handling for avatar serving

// Agent routes - uses machine token authentication, not user auth
app.use('/api/agent', agentRouter);

// Apply rate limiting to dangerous endpoints
app.use('/api/machines/:id/destroy', dangerousActionsLimiter);
app.use('/api/machines/:id/reboot', dangerousActionsLimiter);

// Error handling for API routes
app.use('/api', errorHandler);

// In production, serve the built frontend
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../../client/dist');

  // Serve static files
  app.use(express.static(clientDistPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Don't catch API routes or health check
    if (req.path.startsWith('/api') || req.path === '/health') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      });
    } else {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
} else {
  // 404 handler for development
  app.use((_, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
    });
  });
}

// Setup WebSocket for terminal
setupTerminalWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Machina API server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🖥️  Terminal WebSocket: ws://localhost:${PORT}/ws/terminal`);
});

export default app;
