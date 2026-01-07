/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { database } from '../services/database';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type {
  ApiResponse,
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembership,
  TeamDetailResponse,
  CreateTeamRequest,
  UpdateTeamRequest,
  TeamRole,
  HandleAvailabilityResponse,
} from '@machina/shared';

export const teamsRouter = Router();

// Team avatar upload directory
const DATA_DIR = path.join(process.cwd(), '.data');
const TEAM_AVATARS_DIR = path.join(DATA_DIR, 'team-avatars');

// Ensure team avatars directory exists
if (!fs.existsSync(TEAM_AVATARS_DIR)) {
  fs.mkdirSync(TEAM_AVATARS_DIR, { recursive: true });
}

// Configure multer for team avatar uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEAM_AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const teamId = req.params['id'];
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${teamId}${ext}`);
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

// Generate a secure invite code
function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('base64url');
}

// Validate handle format: lowercase alphanumeric and hyphens, 3-30 chars
function isValidHandle(handle: string): boolean {
  if (!handle || handle.length < 3 || handle.length > 30) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/.test(handle);
}

// Generate a suggested handle from a name
function generateHandleSuggestion(name: string, existingHandle?: string): string {
  let baseHandle = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!baseHandle || baseHandle.length < 3) baseHandle = 'team';

  // Truncate if too long
  if (baseHandle.length > 27) baseHandle = baseHandle.substring(0, 27);

  let suggestion = baseHandle;
  let counter = 1;

  while (!database.isHandleAvailable(suggestion, existingHandle)) {
    suggestion = `${baseHandle}-${counter}`;
    counter++;
    if (counter > 99) {
      // Add random suffix if too many conflicts
      suggestion = `${baseHandle}-${crypto.randomBytes(3).toString('hex')}`;
      break;
    }
  }

  return suggestion;
}

// Middleware to check team membership
function requireTeamMember(roles?: TeamRole[]) {
  return (req: Request, _res: Response, next: () => void) => {
    const teamId = req.params['id'];
    const userId = req.user?.user_id;

    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!teamId) {
      throw new AppError(400, 'BAD_REQUEST', 'Team ID is required');
    }

    const member = database.getTeamMember(teamId, userId);
    if (!member) {
      throw new AppError(403, 'FORBIDDEN', 'You are not a member of this team');
    }

    if (roles && !roles.includes(member.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }

    // Attach member info to request for later use
    (req as Request & { teamMember: TeamMember }).teamMember = member;
    next();
  };
}

/**
 * GET /api/teams
 * List user's teams
 */
teamsRouter.get('/', requireAuth, (req: Request, res: Response, next) => {
  try {
    const userId = req.user!.user_id;
    const teams = database.getUserTeams(userId);

    const response: ApiResponse<TeamWithMembership[]> = {
      success: true,
      data: teams,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/check-handle/:handle
 * Check if a handle is available
 */
teamsRouter.get('/check-handle/:handle', requireAuth, (req: Request, res: Response, next) => {
  try {
    const handle = req.params['handle']!.toLowerCase();
    const excludeTeamId = req.query['exclude'] as string | undefined;

    if (!isValidHandle(handle)) {
      const response: ApiResponse<HandleAvailabilityResponse> = {
        success: true,
        data: {
          handle,
          available: false,
          suggestion: generateHandleSuggestion(handle),
        },
      };
      return res.json(response);
    }

    const available = database.isHandleAvailable(handle, excludeTeamId);

    const response: ApiResponse<HandleAvailabilityResponse> = {
      success: true,
      data: {
        handle,
        available,
        suggestion: available ? undefined : generateHandleSuggestion(handle, excludeTeamId),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams
 * Create a new team
 */
teamsRouter.post('/', requireAuth, (req: Request, res: Response, next) => {
  try {
    const userId = req.user!.user_id;
    const { name, handle }: CreateTeamRequest = req.body;

    if (!name || name.trim().length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Team name is required');
    }

    if (name.length > 100) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Team name must be 100 characters or less');
    }

    if (!handle || handle.trim().length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Team handle is required');
    }

    const normalizedHandle = handle.toLowerCase().trim();

    if (!isValidHandle(normalizedHandle)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Handle must be 3-30 characters, lowercase alphanumeric and hyphens only'
      );
    }

    if (!database.isHandleAvailable(normalizedHandle)) {
      throw new AppError(400, 'HANDLE_TAKEN', 'This handle is already taken');
    }

    const teamId = `team_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const now = new Date().toISOString();

    const team: Team = {
      team_id: teamId,
      name: name.trim(),
      handle: normalizedHandle,
      created_at: now,
      updated_at: now,
      created_by: userId,
    };

    database.insertTeam(team);

    // Add creator as admin
    const memberId = `tmem_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const member: TeamMember = {
      team_member_id: memberId,
      team_id: teamId,
      user_id: userId,
      role: 'admin',
      joined_at: now,
    };

    database.insertTeamMember(member);

    const response: ApiResponse<Team> = {
      success: true,
      data: team,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/:id
 * Get team details
 */
teamsRouter.get('/:id', requireAuth, requireTeamMember(), (req: Request, res: Response, next) => {
  try {
    const teamId = req.params['id']!;
    const currentMember = (req as Request & { teamMember: TeamMember }).teamMember;

    const team = database.getTeam(teamId);
    if (!team) {
      throw new AppError(404, 'NOT_FOUND', 'Team not found');
    }

    const members = database.getTeamMembers(teamId);

    // Only admins can see pending invites
    const pendingInvites =
      currentMember.role === 'admin' ? database.getTeamInvites(teamId) : undefined;

    const responseData: TeamDetailResponse = {
      team,
      members,
      pending_invites: pendingInvites,
      current_user_role: currentMember.role,
    };

    const response: ApiResponse<TeamDetailResponse> = {
      success: true,
      data: responseData,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/teams/:id
 * Update team (name and/or handle)
 */
teamsRouter.put(
  '/:id',
  requireAuth,
  requireTeamMember(['admin']),
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.params['id']!;
      const { name, handle }: UpdateTeamRequest = req.body;

      const updates: { name?: string; handle?: string } = {};

      if (name !== undefined) {
        if (name.trim().length === 0) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Team name cannot be empty');
        }
        if (name.length > 100) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Team name must be 100 characters or less');
        }
        updates.name = name.trim();
      }

      if (handle !== undefined) {
        const normalizedHandle = handle.toLowerCase().trim();

        if (!isValidHandle(normalizedHandle)) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            'Handle must be 3-30 characters, lowercase alphanumeric and hyphens only'
          );
        }

        if (!database.isHandleAvailable(normalizedHandle, teamId)) {
          throw new AppError(400, 'HANDLE_TAKEN', 'This handle is already taken');
        }

        updates.handle = normalizedHandle;
      }

      if (Object.keys(updates).length > 0) {
        database.updateTeam(teamId, updates);
      }

      const updatedTeam = database.getTeam(teamId);

      const response: ApiResponse<Team> = {
        success: true,
        data: updatedTeam!,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/teams/:id/avatar
 * Upload team avatar
 */
teamsRouter.post(
  '/:id/avatar',
  requireAuth,
  requireTeamMember(['admin']),
  upload.single('avatar'),
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.params['id']!;

      if (!req.file) {
        throw new AppError(400, 'VALIDATION_ERROR', 'No file uploaded');
      }

      const avatarPath = req.file.filename;
      database.updateTeam(teamId, { avatar_path: avatarPath });

      const updatedTeam = database.getTeam(teamId);

      const response: ApiResponse<Team> = {
        success: true,
        data: updatedTeam!,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/teams/:id/avatar
 * Remove team avatar
 */
teamsRouter.delete(
  '/:id/avatar',
  requireAuth,
  requireTeamMember(['admin']),
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.params['id']!;
      const team = database.getTeam(teamId);

      if (team?.avatar_url) {
        // Delete file if it exists
        const avatarFilename = path.basename(team.avatar_url);
        const avatarPath = path.join(TEAM_AVATARS_DIR, avatarFilename);
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      database.updateTeam(teamId, { avatar_path: null });

      const updatedTeam = database.getTeam(teamId);

      const response: ApiResponse<Team> = {
        success: true,
        data: updatedTeam!,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/teams/avatars/:filename
 * Serve team avatar image
 */
teamsRouter.get('/avatars/:filename', (req: Request, res: Response, next) => {
  try {
    const filename = req.params['filename'];
    if (!filename) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing filename');
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const avatarPath = path.join(TEAM_AVATARS_DIR, sanitizedFilename);

    if (!fs.existsSync(avatarPath)) {
      throw new AppError(404, 'NOT_FOUND', 'Avatar not found');
    }

    res.sendFile(avatarPath);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/teams/:id
 * Delete team (only admins, and only if they're the sole admin or team has one member)
 */
teamsRouter.delete(
  '/:id',
  requireAuth,
  requireTeamMember(['admin']),
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.params['id']!;
      const team = database.getTeam(teamId);

      if (!team) {
        throw new AppError(404, 'NOT_FOUND', 'Team not found');
      }

      // Delete team avatar if exists
      if (team.avatar_url) {
        const avatarFilename = path.basename(team.avatar_url);
        const avatarPath = path.join(TEAM_AVATARS_DIR, avatarFilename);
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      }

      database.deleteTeam(teamId);

      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/teams/:id/invites
 * Generate invite code
 */
teamsRouter.post(
  '/:id/invites',
  requireAuth,
  requireTeamMember(['admin']),
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.params['id']!;
      const userId = req.user!.user_id;

      const inviteId = `inv_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
      const inviteCode = generateInviteCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite: TeamInvite = {
        invite_id: inviteId,
        team_id: teamId,
        invite_code: inviteCode,
        created_by: userId,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      database.insertTeamInvite(invite);

      const response: ApiResponse<TeamInvite> = {
        success: true,
        data: invite,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/teams/:id/invites/:inviteId
 * Revoke invite
 */
teamsRouter.delete(
  '/:id/invites/:inviteId',
  requireAuth,
  requireTeamMember(['admin']),
  (req: Request, res: Response, next) => {
    try {
      const inviteId = req.params['inviteId']!;

      const invite = database.getTeamInvite(inviteId);
      if (!invite) {
        throw new AppError(404, 'NOT_FOUND', 'Invite not found');
      }

      database.deleteTeamInvite(inviteId);

      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/teams/join
 * Join team with invite code
 */
teamsRouter.post('/join', requireAuth, (req: Request, res: Response, next) => {
  try {
    const userId = req.user!.user_id;
    const { invite_code } = req.body;

    if (!invite_code) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invite code is required');
    }

    const invite = database.getTeamInviteByCode(invite_code);
    if (!invite) {
      throw new AppError(404, 'NOT_FOUND', 'Invalid invite code');
    }

    // Check if invite has been used
    if (invite.used_at) {
      throw new AppError(400, 'INVITE_USED', 'This invite has already been used');
    }

    // Check if invite has expired
    if (new Date(invite.expires_at) < new Date()) {
      throw new AppError(400, 'INVITE_EXPIRED', 'This invite has expired');
    }

    // Check if user is already a member
    const existingMember = database.getTeamMember(invite.team_id, userId);
    if (existingMember) {
      throw new AppError(400, 'ALREADY_MEMBER', 'You are already a member of this team');
    }

    // Create member
    const memberId = `tmem_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const now = new Date().toISOString();

    const member: TeamMember = {
      team_member_id: memberId,
      team_id: invite.team_id,
      user_id: userId,
      role: 'member',
      joined_at: now,
      invited_by: invite.created_by,
    };

    database.insertTeamMember(member);

    // Mark invite as used
    database.markInviteUsed(invite.invite_id, userId);

    // Get team info to return
    const team = database.getTeam(invite.team_id);

    const response: ApiResponse<{ member: TeamMember; team: Team }> = {
      success: true,
      data: { member, team: team! },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/teams/:id/members/:memberId
 * Remove member (admin) or leave team (self)
 */
teamsRouter.delete(
  '/:id/members/:memberId',
  requireAuth,
  requireTeamMember(),
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.params['id']!;
      const memberId = req.params['memberId']!;
      const currentMember = (req as Request & { teamMember: TeamMember }).teamMember;
      const currentUserId = req.user!.user_id;

      const targetMember = database.getTeamMemberById(memberId);
      if (!targetMember || targetMember.team_id !== teamId) {
        throw new AppError(404, 'NOT_FOUND', 'Member not found');
      }

      const isSelf = targetMember.user_id === currentUserId;
      const isAdmin = currentMember.role === 'admin';

      // Must be admin to remove others, or removing self
      if (!isSelf && !isAdmin) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to remove this member');
      }

      // If removing an admin, ensure there's at least one other admin
      if (targetMember.role === 'admin') {
        const adminCount = database.countTeamAdmins(teamId);
        if (adminCount <= 1) {
          throw new AppError(
            400,
            'LAST_ADMIN',
            'Cannot remove the last admin. Transfer ownership or delete the team.'
          );
        }
      }

      database.deleteTeamMember(memberId);

      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/teams/:id/members/:memberId
 * Update member role
 */
teamsRouter.put(
  '/:id/members/:memberId',
  requireAuth,
  requireTeamMember(['admin']),
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.params['id']!;
      const memberId = req.params['memberId']!;
      const { role } = req.body;

      if (!role || !['admin', 'member'].includes(role)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Valid role is required (admin or member)');
      }

      const targetMember = database.getTeamMemberById(memberId);
      if (!targetMember || targetMember.team_id !== teamId) {
        throw new AppError(404, 'NOT_FOUND', 'Member not found');
      }

      // If demoting an admin, ensure there's at least one other admin
      if (targetMember.role === 'admin' && role === 'member') {
        const adminCount = database.countTeamAdmins(teamId);
        if (adminCount <= 1) {
          throw new AppError(
            400,
            'LAST_ADMIN',
            'Cannot demote the last admin. Promote another member first.'
          );
        }
      }

      database.updateTeamMemberRole(memberId, role);

      const updatedMember = database.getTeamMemberById(memberId);

      const response: ApiResponse<TeamMember> = {
        success: true,
        data: updatedMember!,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);
