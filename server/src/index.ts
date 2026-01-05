import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { machinesRouter } from './routes/machines';
import { providersRouter } from './routes/providers';
import { deploymentsRouter } from './routes/deployments';
import { bootstrapRouter } from './routes/bootstrap';
import { auditRouter } from './routes/audit';
import { agentRouter } from './routes/agent';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting for dangerous actions
const dangerousActionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } }
});

// Body parsing
app.use(express.json());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/machines', machinesRouter);
app.use('/api/providers', providersRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/bootstrap', bootstrapRouter);
app.use('/api/audit', auditRouter);
app.use('/api/agent', agentRouter);

// Apply rate limiting to dangerous endpoints
app.use('/api/machines/:id/destroy', dangerousActionsLimiter);
app.use('/api/machines/:id/reboot', dangerousActionsLimiter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((_, res) => {
  res.status(404).json({ 
    success: false, 
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' } 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Machine API server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

export default app;



