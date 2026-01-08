import { Router, type Request, type Response } from 'express';
import { database } from '../services/database';
import { requireAuth, requireTeamContext } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import type { ApiResponse, TeamMemberWithUser, TeamMemberDetail, TeamRole } from '@machina/shared';

export const membersRouter = Router();

/**
 * GET /api/members
 * List members of the current team (from X-Team-Id header)
 */
membersRouter.get('/', requireAuth, requireTeamContext, (req: Request, res: Response, next) => {
  try {
    const teamId = req.teamId as string;
    const { role, search } = req.query;

    let members = database.getTeamMembers(teamId);

    // Apply role filter
    if (role && (role === 'admin' || role === 'member')) {
      members = members.filter((m) => m.role === role);
    }

    // Apply search filter
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      members = members.filter(
        (m) =>
          m.user.display_name.toLowerCase().includes(searchLower) ||
          m.user.email.toLowerCase().includes(searchLower)
      );
    }

    // Sort: admins first, then by display name
    members.sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === 'admin' ? -1 : 1;
      }
      return a.user.display_name.localeCompare(b.user.display_name);
    });

    const response: ApiResponse<TeamMemberWithUser[]> = {
      success: true,
      data: members,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/members/current-role
 * Get the current user's role in the team
 * NOTE: This route must come BEFORE /:memberId to avoid being matched as a memberId
 */
membersRouter.get(
  '/current-role',
  requireAuth,
  requireTeamContext,
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.teamId as string;
      const userId = (req.user as { user_id: string }).user_id;

      const member = database.getTeamMember(teamId, userId);

      if (!member) {
        throw new AppError(403, 'FORBIDDEN', 'You are not a member of this team');
      }

      const response: ApiResponse<{ role: TeamRole }> = {
        success: true,
        data: { role: member.role },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/members/:memberId
 * Get detailed info for a specific member
 */
membersRouter.get(
  '/:memberId',
  requireAuth,
  requireTeamContext,
  (req: Request, res: Response, next) => {
    try {
      const teamId = req.teamId as string;
      const memberId = req.params['memberId'] as string;

      const member = database.getTeamMemberById(memberId);

      if (!member || member.team_id !== teamId) {
        throw new AppError(404, 'NOT_FOUND', 'Member not found');
      }

      // Get the user info for this member
      const memberUser = database.getUser(member.user_id);
      if (!memberUser) {
        throw new AppError(404, 'NOT_FOUND', 'Member user not found');
      }

      // Get invited_by user info if applicable
      let invitedByUser: { user_id: string; display_name: string } | undefined;
      if (member.invited_by) {
        const inviter = database.getUser(member.invited_by);
        if (inviter) {
          invitedByUser = {
            user_id: inviter.user_id,
            display_name: inviter.display_name,
          };
        }
      }

      const memberDetail: TeamMemberDetail = {
        team_member_id: member.team_member_id,
        team_id: member.team_id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        invited_by: member.invited_by,
        user: {
          user_id: memberUser.user_id,
          display_name: memberUser.display_name,
          email: memberUser.email,
          profile_picture_url: memberUser.profile_picture_url
            ? `/api/auth/avatars/${memberUser.profile_picture_url}`
            : undefined,
        },
        invited_by_user: invitedByUser,
      };

      const response: ApiResponse<TeamMemberDetail> = {
        success: true,
        data: memberDetail,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);
