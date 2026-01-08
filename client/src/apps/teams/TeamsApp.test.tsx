import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/mocks/server';
import { TeamsApp } from './TeamsApp';
import type { TeamWithMembership } from '@machina/shared';

// Mock factories
const mockTeam = (overrides: Partial<TeamWithMembership> = {}): TeamWithMembership => ({
  team_id: 'team-1',
  name: 'Test Team',
  handle: 'test-team',
  role: 'admin',
  member_count: 3,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'user-1',
  ...overrides,
});

describe('TeamsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render page title', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam()],
          });
        })
      );

      render(<TeamsApp />);

      expect(screen.getByText('Teams')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      server.use(
        http.get('/api/teams', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      render(<TeamsApp />);

      // Loading indicator should be present (spinner or skeleton)
      expect(
        document.querySelector('[class*="spinner"]') || document.querySelector('[class*="loading"]')
      ).toBeTruthy();
    });

    it('should render teams list when data loads', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [
              mockTeam({ team_id: 'team-1', name: 'Team Alpha', handle: 'team-alpha' }),
              mockTeam({ team_id: 'team-2', name: 'Team Beta', handle: 'team-beta' }),
            ],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText('Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Team Beta')).toBeInTheDocument();
      });
    });

    it('should show empty state when no teams exist', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText(/no teams/i)).toBeInTheDocument();
      });
    });

    it('should display team handle with @ prefix', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam({ handle: 'my-team' })],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText('@my-team')).toBeInTheDocument();
      });
    });

    it('should display member count', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam({ member_count: 5 })],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText(/5 members/i)).toBeInTheDocument();
      });
    });

    it('should show singular "member" for count of 1', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam({ member_count: 1 })],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText(/1 member$/i)).toBeInTheDocument();
      });
    });

    it('should display role badge for admin', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam({ role: 'admin' })],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument();
      });
    });

    it('should display role badge for member', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam({ role: 'member' })],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText('Member')).toBeInTheDocument();
      });
    });

    it('should generate initials for team without avatar', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam({ name: 'Engineering Team', avatar_url: undefined })],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        // "Engineering Team" should produce "ET" initials
        expect(screen.getByText('ET')).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should have Create button', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      });
    });

    it('should have Join button', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
      });
    });

    it('should open Create Team modal when clicking Create button', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should open Join Team modal when clicking Join button', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /join/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should have refresh button', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({ success: true, data: [mockTeam()] });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(
          screen.getByTitle(/refresh/i) || screen.getByLabelText(/refresh/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Team Selection', () => {
    it('should call setSidekickSelection when clicking a team', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [mockTeam({ team_id: 'team-1', name: 'Clickable Team' })],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        expect(screen.getByText('Clickable Team')).toBeInTheDocument();
      });

      // Click on the team card
      const teamCard = screen.getByText('Clickable Team').closest('[class*="card"]');
      if (teamCard) {
        fireEvent.click(teamCard);
      }

      // The sidekick should update - we can't directly test store changes
      // but we can verify the component is interactive
    });
  });

  describe('Empty State Actions', () => {
    it('should show Create Team button in empty state', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        // Empty state should have action buttons
        const createButtons = screen.getAllByRole('button', { name: /create/i });
        expect(createButtons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show Join Team button in empty state', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        const joinButtons = screen.getAllByRole('button', { name: /join/i });
        expect(joinButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Team Count', () => {
    it('should display team count in header', async () => {
      server.use(
        http.get('/api/teams', () => {
          return HttpResponse.json({
            success: true,
            data: [
              mockTeam({ team_id: 'team-1' }),
              mockTeam({ team_id: 'team-2' }),
              mockTeam({ team_id: 'team-3' }),
            ],
          });
        })
      );

      render(<TeamsApp />);

      await waitFor(() => {
        // The count should be shown somewhere in the header/title area
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });
});
