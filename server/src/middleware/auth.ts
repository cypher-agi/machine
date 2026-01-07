import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { database } from '../services/database';
import { AppError } from './errorHandler';
import type { User, UserRole, TeamRole } from '@machina/shared';

// Extend Express Request to include user and team context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      teamId?: string; // Current team context
      teamRole?: TeamRole; // User's role in the current team
    }
  }
}

/**
 * Hash a session token for storage/lookup
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Main auth middleware - requires authentication
 * Validates session token and attaches user to request
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const tokenHash = hashToken(token);
    const session = database.getSessionByToken(tokenHash);

    if (!session) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired session');
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      database.deleteSession(session.session_id);
      throw new AppError(401, 'SESSION_EXPIRED', 'Session has expired');
    }

    // Get user
    const user = database.getUser(session.user_id);
    if (!user) {
      database.deleteSession(session.session_id);
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found');
    }

    // Update session activity
    database.updateSessionActivity(session.session_id);

    // Attach user and session to request (strip password hash)
    const { password_hash: _, ...safeUser } = user;
    req.user = safeUser;
    req.sessionId = session.session_id;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional auth middleware - doesn't fail if not logged in
 * Useful for endpoints that work differently based on auth state
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      return next();
    }

    const tokenHash = hashToken(token);
    const session = database.getSessionByToken(tokenHash);

    if (!session) {
      return next();
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      database.deleteSession(session.session_id);
      return next();
    }

    // Get user
    const user = database.getUser(session.user_id);
    if (!user) {
      database.deleteSession(session.session_id);
      return next();
    }

    // Update session activity
    database.updateSessionActivity(session.session_id);

    // Attach user and session to request
    const { password_hash: _, ...safeUser } = user;
    req.user = safeUser;
    req.sessionId = session.session_id;

    next();
  } catch {
    // On any error, just continue without auth
    next();
  }
}

/**
 * Role-based access control middleware
 * Must be used after requireAuth
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
    }

    next();
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Require user or admin role (not readonly)
 */
export const requireWrite = requireRole('admin', 'user');

/**
 * Team context middleware - extracts team ID from header and validates membership
 * Must be used after requireAuth
 */
export function requireTeamContext(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    // Get team ID from header
    const teamId = req.headers['x-team-id'] as string;

    if (!teamId) {
      throw new AppError(400, 'MISSING_TEAM', 'Team context required. Include X-Team-Id header.');
    }

    // Verify user is a member of this team
    const membership = database.getTeamMember(teamId, req.user.user_id);

    if (!membership) {
      throw new AppError(403, 'NOT_TEAM_MEMBER', 'You are not a member of this team');
    }

    // Attach team context to request
    req.teamId = teamId;
    req.teamRole = membership.role;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require team admin role
 * Must be used after requireTeamContext
 */
export function requireTeamAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.teamId || !req.teamRole) {
    return next(new AppError(400, 'MISSING_TEAM', 'Team context required'));
  }

  if (req.teamRole !== 'admin') {
    return next(new AppError(403, 'NOT_TEAM_ADMIN', 'Team admin access required'));
  }

  next();
}
