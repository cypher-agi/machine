import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Mock database
const mockDatabase = {
  getUserTeams: vi.fn(),
  getTeam: vi.fn(),
  getTeamMembers: vi.fn(),
  getTeamMember: vi.fn(),
  getTeamMemberById: vi.fn(),
  insertTeam: vi.fn(),
  insertTeamMember: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  deleteTeamMember: vi.fn(),
  updateTeamMemberRole: vi.fn(),
  countTeamAdmins: vi.fn(),
  isHandleAvailable: vi.fn(),
  getTeamInvites: vi.fn(),
  getTeamInvite: vi.fn(),
  getTeamInviteByCode: vi.fn(),
  insertTeamInvite: vi.fn(),
  deleteTeamInvite: vi.fn(),
  markInviteUsed: vi.fn(),
  insertAuditEvent: vi.fn(),
};

vi.mock('../../src/services/database', () => ({
  database: mockDatabase,
  default: mockDatabase,
}));

// Mock auth middleware
const mockUser = { user_id: 'user-1', email: 'test@example.com' };

describe('Teams API Integration', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    // Mock authentication
    app.use((req, _res, next) => {
      req.user = mockUser;
      next();
    });

    // GET /api/teams - List user's teams
    app.get('/api/teams', (req, res) => {
      const userId = req.user?.user_id;
      const teams = mockDatabase.getUserTeams(userId);
      res.json({ success: true, data: teams });
    });

    // GET /api/teams/check-handle/:handle - Check handle availability
    app.get('/api/teams/check-handle/:handle', (req, res) => {
      const handle = req.params.handle?.toLowerCase();
      const excludeTeamId = req.query.exclude as string | undefined;

      // Simple validation
      if (!handle || handle.length < 3 || handle.length > 30) {
        return res.json({
          success: true,
          data: { handle, available: false, suggestion: `${handle}-1` },
        });
      }

      const available = mockDatabase.isHandleAvailable(handle, excludeTeamId);
      res.json({
        success: true,
        data: {
          handle,
          available,
          suggestion: available ? undefined : `${handle}-1`,
        },
      });
    });

    // POST /api/teams - Create team
    app.post('/api/teams', (req, res) => {
      const userId = req.user?.user_id;
      const { name, handle } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Team name is required' },
        });
      }

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Team name must be 100 characters or less' },
        });
      }

      if (!handle?.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Team handle is required' },
        });
      }

      const normalizedHandle = handle.toLowerCase().trim();

      // Validate handle format
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/.test(normalizedHandle)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Handle must be 3-30 characters, lowercase alphanumeric and hyphens only',
          },
        });
      }

      if (!mockDatabase.isHandleAvailable(normalizedHandle)) {
        return res.status(400).json({
          success: false,
          error: { code: 'HANDLE_TAKEN', message: 'This handle is already taken' },
        });
      }

      const teamId = `team_new123`;
      const now = new Date().toISOString();

      const team = {
        team_id: teamId,
        name: name.trim(),
        handle: normalizedHandle,
        created_at: now,
        updated_at: now,
        created_by: userId,
      };

      mockDatabase.insertTeam(team);
      mockDatabase.insertTeamMember({
        team_member_id: 'tmem_1',
        team_id: teamId,
        user_id: userId,
        role: 'admin',
        joined_at: now,
      });

      res.status(201).json({ success: true, data: team });
    });

    // GET /api/teams/:id - Get team details
    app.get('/api/teams/:id', (req, res) => {
      const teamId = req.params.id;
      const userId = req.user?.user_id;

      const member = mockDatabase.getTeamMember(teamId, userId);
      if (!member) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not a member of this team' },
        });
      }

      const team = mockDatabase.getTeam(teamId);
      if (!team) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Team not found' },
        });
      }

      const members = mockDatabase.getTeamMembers(teamId);
      const pendingInvites =
        member.role === 'admin' ? mockDatabase.getTeamInvites(teamId) : undefined;

      res.json({
        success: true,
        data: {
          team,
          members,
          pending_invites: pendingInvites,
          current_user_role: member.role,
        },
      });
    });

    // PUT /api/teams/:id - Update team
    app.put('/api/teams/:id', (req, res) => {
      const teamId = req.params.id;
      const userId = req.user?.user_id;
      const { name, handle } = req.body;

      const member = mockDatabase.getTeamMember(teamId, userId);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      if (name !== undefined && !name.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Team name cannot be empty' },
        });
      }

      if (handle !== undefined) {
        const normalizedHandle = handle.toLowerCase().trim();
        if (!mockDatabase.isHandleAvailable(normalizedHandle, teamId)) {
          return res.status(400).json({
            success: false,
            error: { code: 'HANDLE_TAKEN', message: 'This handle is already taken' },
          });
        }
      }

      mockDatabase.updateTeam(teamId, { name, handle });
      const updatedTeam = mockDatabase.getTeam(teamId);

      res.json({ success: true, data: updatedTeam });
    });

    // DELETE /api/teams/:id - Delete team
    app.delete('/api/teams/:id', (req, res) => {
      const teamId = req.params.id;
      const userId = req.user?.user_id;

      const member = mockDatabase.getTeamMember(teamId, userId);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const team = mockDatabase.getTeam(teamId);
      if (!team) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Team not found' },
        });
      }

      mockDatabase.deleteTeam(teamId);
      res.json({ success: true, data: { deleted: true } });
    });

    // POST /api/teams/:id/invites - Generate invite
    app.post('/api/teams/:id/invites', (req, res) => {
      const teamId = req.params.id;
      const userId = req.user?.user_id;

      const member = mockDatabase.getTeamMember(teamId, userId);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const invite = {
        invite_id: 'inv_123',
        team_id: teamId,
        invite_code: 'ABC123',
        created_by: userId,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockDatabase.insertTeamInvite(invite);
      res.status(201).json({ success: true, data: invite });
    });

    // DELETE /api/teams/:id/invites/:inviteId - Revoke invite
    app.delete('/api/teams/:id/invites/:inviteId', (req, res) => {
      const teamId = req.params.id;
      const inviteId = req.params.inviteId;
      const userId = req.user?.user_id;

      const member = mockDatabase.getTeamMember(teamId, userId);
      if (!member || member.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const invite = mockDatabase.getTeamInvite(inviteId);
      if (!invite) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Invite not found' },
        });
      }

      mockDatabase.deleteTeamInvite(inviteId);
      res.json({ success: true, data: { deleted: true } });
    });

    // POST /api/teams/join - Join team with invite code
    app.post('/api/teams/join', (req, res) => {
      const userId = req.user?.user_id;
      const { invite_code } = req.body;

      if (!invite_code) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invite code is required' },
        });
      }

      const invite = mockDatabase.getTeamInviteByCode(invite_code);
      if (!invite) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Invalid invite code' },
        });
      }

      if (invite.used_at) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVITE_USED', message: 'This invite has already been used' },
        });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVITE_EXPIRED', message: 'This invite has expired' },
        });
      }

      const existingMember = mockDatabase.getTeamMember(invite.team_id, userId);
      if (existingMember) {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_MEMBER', message: 'You are already a member of this team' },
        });
      }

      const member = {
        team_member_id: 'tmem_new',
        team_id: invite.team_id,
        user_id: userId,
        role: 'member',
        joined_at: new Date().toISOString(),
        invited_by: invite.created_by,
      };

      mockDatabase.insertTeamMember(member);
      mockDatabase.markInviteUsed(invite.invite_id, userId);

      const team = mockDatabase.getTeam(invite.team_id);
      res.status(201).json({ success: true, data: { member, team } });
    });

    // DELETE /api/teams/:id/members/:memberId - Remove member
    app.delete('/api/teams/:id/members/:memberId', (req, res) => {
      const teamId = req.params.id;
      const memberId = req.params.memberId;
      const currentUserId = req.user?.user_id;

      const currentMember = mockDatabase.getTeamMember(teamId, currentUserId);
      if (!currentMember) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not a member of this team' },
        });
      }

      const targetMember = mockDatabase.getTeamMemberById(memberId);
      if (!targetMember || targetMember.team_id !== teamId) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Member not found' },
        });
      }

      const isSelf = targetMember.user_id === currentUserId;
      const isAdmin = currentMember.role === 'admin';

      if (!isSelf && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to remove this member' },
        });
      }

      if (targetMember.role === 'admin') {
        const adminCount = mockDatabase.countTeamAdmins(teamId);
        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            error: { code: 'LAST_ADMIN', message: 'Cannot remove the last admin' },
          });
        }
      }

      mockDatabase.deleteTeamMember(memberId);
      res.json({ success: true, data: { deleted: true } });
    });

    // PUT /api/teams/:id/members/:memberId - Update member role
    app.put('/api/teams/:id/members/:memberId', (req, res) => {
      const teamId = req.params.id;
      const memberId = req.params.memberId;
      const currentUserId = req.user?.user_id;
      const { role } = req.body;

      const currentMember = mockDatabase.getTeamMember(teamId, currentUserId);
      if (!currentMember || currentMember.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      if (!role || !['admin', 'member'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid role is required (admin or member)' },
        });
      }

      const targetMember = mockDatabase.getTeamMemberById(memberId);
      if (!targetMember || targetMember.team_id !== teamId) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Member not found' },
        });
      }

      if (targetMember.role === 'admin' && role === 'member') {
        const adminCount = mockDatabase.countTeamAdmins(teamId);
        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            error: { code: 'LAST_ADMIN', message: 'Cannot demote the last admin' },
          });
        }
      }

      mockDatabase.updateTeamMemberRole(memberId, role);
      const updatedMember = mockDatabase.getTeamMemberById(memberId);
      res.json({ success: true, data: updatedMember });
    });
  });

  describe('GET /api/teams', () => {
    it('should return list of user teams', async () => {
      const mockTeams = [
        { team_id: 'team-1', name: 'Team 1', handle: 'team-one', role: 'admin', member_count: 3 },
        { team_id: 'team-2', name: 'Team 2', handle: 'team-two', role: 'member', member_count: 5 },
      ];
      mockDatabase.getUserTeams.mockReturnValue(mockTeams);

      const response = await request(app).get('/api/teams');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return empty array when user has no teams', async () => {
      mockDatabase.getUserTeams.mockReturnValue([]);

      const response = await request(app).get('/api/teams');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/teams/check-handle/:handle', () => {
    it('should return available true for unique handle', async () => {
      mockDatabase.isHandleAvailable.mockReturnValue(true);

      const response = await request(app).get('/api/teams/check-handle/my-team');

      expect(response.status).toBe(200);
      expect(response.body.data.handle).toBe('my-team');
      expect(response.body.data.available).toBe(true);
    });

    it('should return available false with suggestion for taken handle', async () => {
      mockDatabase.isHandleAvailable.mockReturnValue(false);

      const response = await request(app).get('/api/teams/check-handle/taken-handle');

      expect(response.status).toBe(200);
      expect(response.body.data.available).toBe(false);
      expect(response.body.data.suggestion).toBeDefined();
    });

    it('should return available false for handles too short', async () => {
      const response = await request(app).get('/api/teams/check-handle/ab');

      expect(response.status).toBe(200);
      expect(response.body.data.available).toBe(false);
    });
  });

  describe('POST /api/teams', () => {
    beforeEach(() => {
      mockDatabase.isHandleAvailable.mockReturnValue(true);
    });

    it('should create team with valid data', async () => {
      const response = await request(app).post('/api/teams').send({
        name: 'New Team',
        handle: 'new-team',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Team');
      expect(response.body.data.handle).toBe('new-team');
      expect(mockDatabase.insertTeam).toHaveBeenCalled();
      expect(mockDatabase.insertTeamMember).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' })
      );
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app).post('/api/teams').send({
        handle: 'new-team',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when handle is missing', async () => {
      const response = await request(app).post('/api/teams').send({
        name: 'New Team',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is too long', async () => {
      const response = await request(app)
        .post('/api/teams')
        .send({
          name: 'A'.repeat(101),
          handle: 'new-team',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when handle format is invalid', async () => {
      const response = await request(app).post('/api/teams').send({
        name: 'New Team',
        handle: 'INVALID_HANDLE!',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when handle is already taken', async () => {
      mockDatabase.isHandleAvailable.mockReturnValue(false);

      const response = await request(app).post('/api/teams').send({
        name: 'New Team',
        handle: 'taken-handle',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('HANDLE_TAKEN');
    });

    it('should normalize handle to lowercase', async () => {
      const response = await request(app).post('/api/teams').send({
        name: 'New Team',
        handle: 'My-Team-Handle',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.handle).toBe('my-team-handle');
    });
  });

  describe('GET /api/teams/:id', () => {
    it('should return team details for members', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'member' });
      mockDatabase.getTeam.mockReturnValue({ team_id: 'team-1', name: 'Test Team' });
      mockDatabase.getTeamMembers.mockReturnValue([
        { team_member_id: 'tm-1', role: 'admin' },
        { team_member_id: 'tm-2', role: 'member' },
      ]);

      const response = await request(app).get('/api/teams/team-1');

      expect(response.status).toBe(200);
      expect(response.body.data.team.name).toBe('Test Team');
      expect(response.body.data.members).toHaveLength(2);
      expect(response.body.data.current_user_role).toBe('member');
    });

    it('should include pending invites for admins', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });
      mockDatabase.getTeam.mockReturnValue({ team_id: 'team-1' });
      mockDatabase.getTeamMembers.mockReturnValue([]);
      mockDatabase.getTeamInvites.mockReturnValue([{ invite_id: 'inv-1' }]);

      const response = await request(app).get('/api/teams/team-1');

      expect(response.status).toBe(200);
      expect(response.body.data.pending_invites).toHaveLength(1);
    });

    it('should not include pending invites for non-admins', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'member' });
      mockDatabase.getTeam.mockReturnValue({ team_id: 'team-1' });
      mockDatabase.getTeamMembers.mockReturnValue([]);

      const response = await request(app).get('/api/teams/team-1');

      expect(response.status).toBe(200);
      expect(response.body.data.pending_invites).toBeUndefined();
    });

    it('should return 403 for non-members', async () => {
      mockDatabase.getTeamMember.mockReturnValue(undefined);

      const response = await request(app).get('/api/teams/team-1');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/teams/:id', () => {
    it('should update team name', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });
      mockDatabase.getTeam.mockReturnValue({ team_id: 'team-1', name: 'Updated Name' });

      const response = await request(app).put('/api/teams/team-1').send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(mockDatabase.updateTeam).toHaveBeenCalledWith(
        'team-1',
        expect.objectContaining({ name: 'Updated Name' })
      );
    });

    it('should return 403 for non-admins', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'member' });

      const response = await request(app).put('/api/teams/team-1').send({ name: 'New Name' });

      expect(response.status).toBe(403);
    });

    it('should return 400 for empty name', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });

      const response = await request(app).put('/api/teams/team-1').send({ name: '   ' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/teams/:id', () => {
    it('should delete team as admin', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });
      mockDatabase.getTeam.mockReturnValue({ team_id: 'team-1' });

      const response = await request(app).delete('/api/teams/team-1');

      expect(response.status).toBe(200);
      expect(response.body.data.deleted).toBe(true);
      expect(mockDatabase.deleteTeam).toHaveBeenCalledWith('team-1');
    });

    it('should return 403 for non-admins', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'member' });

      const response = await request(app).delete('/api/teams/team-1');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/teams/:id/invites', () => {
    it('should create invite as admin', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });

      const response = await request(app).post('/api/teams/team-1/invites');

      expect(response.status).toBe(201);
      expect(response.body.data.invite_code).toBeDefined();
      expect(mockDatabase.insertTeamInvite).toHaveBeenCalled();
    });

    it('should return 403 for non-admins', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'member' });

      const response = await request(app).post('/api/teams/team-1/invites');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/teams/join', () => {
    const validInvite = {
      invite_id: 'inv-1',
      team_id: 'team-1',
      invite_code: 'VALID_CODE',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_by: 'user-admin',
    };

    it('should join team with valid invite code', async () => {
      mockDatabase.getTeamInviteByCode.mockReturnValue(validInvite);
      mockDatabase.getTeamMember.mockReturnValue(undefined);
      mockDatabase.getTeam.mockReturnValue({ team_id: 'team-1', name: 'Test Team' });

      const response = await request(app)
        .post('/api/teams/join')
        .send({ invite_code: 'VALID_CODE' });

      expect(response.status).toBe(201);
      expect(response.body.data.member).toBeDefined();
      expect(response.body.data.team).toBeDefined();
      expect(mockDatabase.insertTeamMember).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member' })
      );
    });

    it('should return 400 for missing invite code', async () => {
      const response = await request(app).post('/api/teams/join').send({});

      expect(response.status).toBe(400);
    });

    it('should return 404 for invalid invite code', async () => {
      mockDatabase.getTeamInviteByCode.mockReturnValue(undefined);

      const response = await request(app).post('/api/teams/join').send({ invite_code: 'INVALID' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for used invite', async () => {
      mockDatabase.getTeamInviteByCode.mockReturnValue({
        ...validInvite,
        used_at: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/api/teams/join')
        .send({ invite_code: 'USED_CODE' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVITE_USED');
    });

    it('should return 400 for expired invite', async () => {
      mockDatabase.getTeamInviteByCode.mockReturnValue({
        ...validInvite,
        expires_at: new Date(Date.now() - 86400000).toISOString(),
      });

      const response = await request(app).post('/api/teams/join').send({ invite_code: 'EXPIRED' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVITE_EXPIRED');
    });

    it('should return 400 if already a member', async () => {
      mockDatabase.getTeamInviteByCode.mockReturnValue(validInvite);
      mockDatabase.getTeamMember.mockReturnValue({ role: 'member' });

      const response = await request(app)
        .post('/api/teams/join')
        .send({ invite_code: 'VALID_CODE' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ALREADY_MEMBER');
    });
  });

  describe('DELETE /api/teams/:id/members/:memberId', () => {
    it('should allow admin to remove member', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin', user_id: 'user-1' });
      mockDatabase.getTeamMemberById.mockReturnValue({
        team_member_id: 'tm-2',
        team_id: 'team-1',
        user_id: 'user-2',
        role: 'member',
      });

      const response = await request(app).delete('/api/teams/team-1/members/tm-2');

      expect(response.status).toBe(200);
      expect(mockDatabase.deleteTeamMember).toHaveBeenCalledWith('tm-2');
    });

    it('should allow member to remove themselves', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'member', user_id: 'user-1' });
      mockDatabase.getTeamMemberById.mockReturnValue({
        team_member_id: 'tm-1',
        team_id: 'team-1',
        user_id: 'user-1',
        role: 'member',
      });

      const response = await request(app).delete('/api/teams/team-1/members/tm-1');

      expect(response.status).toBe(200);
    });

    it('should prevent removing last admin', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin', user_id: 'user-1' });
      mockDatabase.getTeamMemberById.mockReturnValue({
        team_member_id: 'tm-1',
        team_id: 'team-1',
        user_id: 'user-1',
        role: 'admin',
      });
      mockDatabase.countTeamAdmins.mockReturnValue(1);

      const response = await request(app).delete('/api/teams/team-1/members/tm-1');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('LAST_ADMIN');
    });
  });

  describe('PUT /api/teams/:id/members/:memberId', () => {
    it('should update member role to admin', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });
      mockDatabase.getTeamMemberById.mockReturnValue({
        team_member_id: 'tm-2',
        team_id: 'team-1',
        role: 'member',
      });

      const response = await request(app)
        .put('/api/teams/team-1/members/tm-2')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(mockDatabase.updateTeamMemberRole).toHaveBeenCalledWith('tm-2', 'admin');
    });

    it('should prevent demoting last admin', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });
      mockDatabase.getTeamMemberById.mockReturnValue({
        team_member_id: 'tm-1',
        team_id: 'team-1',
        role: 'admin',
      });
      mockDatabase.countTeamAdmins.mockReturnValue(1);

      const response = await request(app)
        .put('/api/teams/team-1/members/tm-1')
        .send({ role: 'member' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('LAST_ADMIN');
    });

    it('should return 400 for invalid role', async () => {
      mockDatabase.getTeamMember.mockReturnValue({ role: 'admin' });

      const response = await request(app)
        .put('/api/teams/team-1/members/tm-2')
        .send({ role: 'superadmin' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
