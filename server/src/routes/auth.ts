/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { database } from '../services/database';
import { requireAuth, generateSessionToken, hashToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type { ApiResponse, User, LoginRequest, LoginResponse, Session } from '@machina/shared';

export const authRouter = Router();

// Config
const SALT_ROUNDS = 12;
const SESSION_DURATION_HOURS = 24;
const REMEMBER_ME_DURATION_DAYS = 30;
const isProduction = process.env['NODE_ENV'] === 'production';

// Avatar upload directory
const DATA_DIR = path.join(process.cwd(), '.data');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

// Ensure avatars directory exists
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.user?.user_id || 'temp'}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

/**
 * Create a session for a user
 */
function createSession(
  userId: string,
  rememberMe: boolean,
  ipAddress?: string,
  userAgent?: string
): { session: Session; token: string } {
  const sessionId = `sess_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();

  const durationMs = rememberMe
    ? REMEMBER_ME_DURATION_DAYS * 24 * 60 * 60 * 1000
    : SESSION_DURATION_HOURS * 60 * 60 * 1000;

  const expiresAt = new Date(now.getTime() + durationMs);

  const sessionData = {
    session_id: sessionId,
    user_id: userId,
    token_hash: tokenHash,
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_activity_at: now.toISOString(),
  };

  database.insertSession(sessionData as Session & { token_hash: string });

  // Return session without token_hash, but with the raw token
  const safeSession: Session = {
    session_id: sessionId,
    user_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_activity_at: now.toISOString(),
  };
  return { session: safeSession, token };
}

/**
 * POST /api/auth/login
 * Login with email and password
 */
authRouter.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { email, password, remember_me }: LoginRequest = req.body;

    if (!email || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email and password are required');
    }

    // Find user by email
    const user = database.getUserByEmail(email);
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Ensure user has at least one team (for existing users before teams feature)
    const userTeams = database.getUserTeams(user.user_id);
    if (userTeams.length === 0) {
      database.createDefaultTeam(user.user_id, user.display_name || 'User');
      console.log('👥 Created default team for existing user:', email);
    }

    // Update last login
    database.updateUserLastLogin(user.user_id);

    // Create session
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    const { session, token } = createSession(user.user_id, !!remember_me, ipAddress, userAgent);

    // Return user without password hash
    const { password_hash: _, ...safeUser } = user;

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: safeUser,
        session_token: token,
        expires_at: session.expires_at,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/dev-login
 * Quick login for development (creates dev user if needed)
 * Only available in non-production mode
 */
authRouter.post('/dev-login', async (req: Request, res: Response, next) => {
  try {
    if (isProduction) {
      throw new AppError(404, 'NOT_FOUND', 'Endpoint not found');
    }

    const devEmail = 'dev@localhost';
    let user = database.getUserByEmail(devEmail);

    if (!user) {
      // Create dev user
      const userId = `user_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
      const passwordHash = await bcrypt.hash('dev', SALT_ROUNDS);
      const now = new Date().toISOString();

      const newUser: User & { password_hash: string } = {
        user_id: userId,
        email: devEmail,
        password_hash: passwordHash,
        display_name: 'Developer',
        role: 'admin',
        created_at: now,
        updated_at: now,
      };

      database.insertUser(newUser);
      user = database.getUserByEmail(devEmail);
      console.log('👤 Created dev user:', devEmail);
    }

    if (!user) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create dev user');
    }

    // Ensure user has at least one team (create default if needed)
    const userTeams = database.getUserTeams(user.user_id);
    if (userTeams.length === 0) {
      database.createDefaultTeam(user.user_id, user.display_name || 'Developer');
      console.log('👥 Created default team for dev user');
    }

    // Update last login
    database.updateUserLastLogin(user.user_id);

    // Create session
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    const { session, token } = createSession(user.user_id, true, ipAddress, userAgent);

    // Return user without password hash
    const { password_hash: _, ...safeUser } = user;

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: safeUser,
        session_token: token,
        expires_at: session.expires_at,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout current session
 */
authRouter.post('/logout', requireAuth, (req: Request, res: Response, next) => {
  try {
    if (req.sessionId) {
      database.deleteSession(req.sessionId);
    }

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout-all
 * Logout all sessions for current user
 */
authRouter.post('/logout-all', requireAuth, (req: Request, res: Response, next) => {
  try {
    if (req.user) {
      database.deleteUserSessions(req.user.user_id);
    }

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  const response: ApiResponse<User> = {
    success: true,
    data: req.user!,
  };

  res.json(response);
});

/**
 * PUT /api/auth/me
 * Update current user profile
 */
authRouter.put('/me', requireAuth, async (req: Request, res: Response, next) => {
  try {
    const { display_name, email, current_password, new_password } = req.body;
    const userId = req.user!.user_id;

    // If changing password, verify current password
    if (new_password) {
      if (!current_password) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Current password is required to set new password'
        );
      }

      const user = database.getUser(userId);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      const passwordValid = await bcrypt.compare(current_password, user.password_hash);
      if (!passwordValid) {
        throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect');
      }

      const newPasswordHash = await bcrypt.hash(new_password, SALT_ROUNDS);
      database.updateUserPassword(userId, newPasswordHash);
    }

    // Update other fields if provided
    if (display_name || email) {
      database.updateUser({
        user_id: userId,
        ...(display_name && { display_name }),
        ...(email && { email }),
      });
    }

    // Get updated user
    const updatedUser = database.getUser(userId);
    if (!updatedUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const { password_hash: _, ...safeUser } = updatedUser;

    const response: ApiResponse<User> = {
      success: true,
      data: safeUser,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/me/avatar
 * Upload profile picture
 */
authRouter.post(
  '/me/avatar',
  requireAuth,
  upload.single('avatar'),
  (req: Request, res: Response, next) => {
    try {
      if (!req.file) {
        throw new AppError(400, 'VALIDATION_ERROR', 'No file uploaded');
      }

      const userId = req.user!.user_id;
      const avatarPath = req.file.filename;

      // Update user profile picture path
      database.updateUserProfilePicture(userId, avatarPath);

      // Get updated user
      const updatedUser = database.getUser(userId);
      if (!updatedUser) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      const { password_hash: _, ...safeUser } = updatedUser;
      // Convert path to URL
      safeUser.profile_picture_url = `/api/auth/avatars/${avatarPath}`;

      const response: ApiResponse<User> = {
        success: true,
        data: safeUser,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/auth/me/avatar
 * Remove profile picture
 */
authRouter.delete('/me/avatar', requireAuth, (req: Request, res: Response, next) => {
  try {
    const userId = req.user!.user_id;
    const user = database.getUser(userId);

    if (user?.profile_picture_url) {
      // Delete file if it exists
      const avatarFilename = path.basename(user.profile_picture_url);
      const avatarPath = path.join(AVATARS_DIR, avatarFilename);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    database.updateUserProfilePicture(userId, null);

    // Get updated user
    const updatedUser = database.getUser(userId);
    if (!updatedUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const { password_hash: _, ...safeUser } = updatedUser;

    const response: ApiResponse<User> = {
      success: true,
      data: safeUser,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/avatars/:filename
 * Serve avatar image
 */
authRouter.get('/avatars/:filename', (req: Request, res: Response, next) => {
  try {
    const filename = req.params['filename'];
    if (!filename) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing filename');
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const avatarPath = path.join(AVATARS_DIR, sanitizedFilename);

    if (!fs.existsSync(avatarPath)) {
      throw new AppError(404, 'NOT_FOUND', 'Avatar not found');
    }

    res.sendFile(avatarPath);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/sessions
 * List current user's sessions
 */
authRouter.get('/sessions', requireAuth, (req: Request, res: Response, next) => {
  try {
    const sessions = database.getSessions(req.user!.user_id);

    // Mark current session and hide token hashes
    const sessionsWithCurrent = sessions.map((session) => ({
      ...session,
      is_current: session.session_id === req.sessionId,
    }));

    const response: ApiResponse<Session[]> = {
      success: true,
      data: sessionsWithCurrent,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/auth/sessions/:id
 * Revoke a specific session
 */
authRouter.delete('/sessions/:id', requireAuth, (req: Request, res: Response, next) => {
  try {
    const id = req.params['id'];
    if (!id) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing session ID');
    }

    // Verify session belongs to current user
    const session = database.getSession(id);
    if (!session || session.user_id !== req.user!.user_id) {
      throw new AppError(404, 'NOT_FOUND', 'Session not found');
    }

    database.deleteSession(id);

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/register
 * Register a new user - open registration
 * First user gets admin role, subsequent users get 'user' role
 */
authRouter.post('/register', async (req: Request, res: Response, next) => {
  try {
    const { email, password, display_name } = req.body;

    if (!email || !password || !display_name) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email, password, and display name are required');
    }

    if (password.length < 6) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 6 characters');
    }

    // Check if email already exists
    const existingUser = database.getUserByEmail(email);
    if (existingUser) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }

    // Check if any users exist (first user gets admin role)
    const userCount = database.getUserCount();

    // Create user
    const userId = `user_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    // First user gets admin role, others get user role
    const role = userCount === 0 ? 'admin' : 'user';

    const newUser: User & { password_hash: string } = {
      user_id: userId,
      email,
      password_hash: passwordHash,
      display_name,
      role,
      created_at: now,
      updated_at: now,
    };

    database.insertUser(newUser);

    // Create default personal team for new user
    database.createDefaultTeam(userId, display_name);

    // Create session for new user
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    const { session, token } = createSession(userId, false, ipAddress, userAgent);

    const { password_hash: _, ...safeUser } = newUser;

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: safeUser,
        session_token: token,
        expires_at: session.expires_at,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/status
 * Check if authentication is required and if users exist
 * Public endpoint
 */
authRouter.get('/status', (_req: Request, res: Response) => {
  const userCount = database.getUserCount();

  const response: ApiResponse<{
    has_users: boolean;
    requires_setup: boolean;
    dev_mode: boolean;
  }> = {
    success: true,
    data: {
      has_users: userCount > 0,
      requires_setup: userCount === 0,
      dev_mode: !isProduction,
    },
  };

  res.json(response);
});
