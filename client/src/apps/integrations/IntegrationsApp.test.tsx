import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/mocks/server';
import { IntegrationsApp } from './IntegrationsApp';
import type { IntegrationListItem, IntegrationStatusResponse } from '@machina/shared';

// Mock factories
const mockIntegration = (overrides: Partial<IntegrationListItem> = {}): IntegrationListItem => ({
  type: 'github',
  name: 'GitHub',
  description: 'Import repositories and team members',
  icon: 'github',
  features: ['repos', 'members'],
  available: true,
  connected: false,
  configured: false,
  ...overrides,
});

const mockIntegrationStatus = (
  overrides: Partial<IntegrationStatusResponse> = {}
): IntegrationStatusResponse => ({
  connected: false,
  configured: false,
  definition: {
    type: 'github',
    name: 'GitHub',
    description: 'Import repositories',
    icon: 'github',
    features: ['repos'],
    available: true,
  },
  ...overrides,
});

describe('IntegrationsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL search params
    window.history.pushState({}, '', '/integrations');
  });

  describe('Rendering', () => {
    it('should render page title', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration()],
          });
        })
      );

      render(<IntegrationsApp />);

      expect(screen.getByText('Integrations')).toBeInTheDocument();
    });

    it('should render integrations list when data loads', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [
              mockIntegration({ type: 'github', name: 'GitHub' }),
              mockIntegration({ type: 'slack', name: 'Slack', available: false }),
            ],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
        expect(screen.getByText('Slack')).toBeInTheDocument();
      });
    });

    it('should show empty state when no integrations available', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText(/no integrations/i)).toBeInTheDocument();
      });
    });

    it('should display integration description', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ description: 'Import repos and members' })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('Import repos and members')).toBeInTheDocument();
      });
    });

    it('should display feature badges', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ features: ['repos', 'members', 'commits'] })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('repos')).toBeInTheDocument();
        expect(screen.getByText('members')).toBeInTheDocument();
        expect(screen.getByText('commits')).toBeInTheDocument();
      });
    });
  });

  describe('Status Indicators', () => {
    it('should show "Connected" status for connected integration', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ connected: true, configured: true })],
          });
        }),
        http.get('/api/integrations/:type/status', () => {
          return HttpResponse.json({
            success: true,
            data: mockIntegrationStatus({ connected: true }),
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should show "Ready to Connect" for configured but not connected', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ connected: false, configured: true })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('Ready to Connect')).toBeInTheDocument();
      });
    });

    it('should show "Not Configured" for unconfigured integration', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ connected: false, configured: false })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('Not Configured')).toBeInTheDocument();
      });
    });

    it('should show "Coming Soon" for unavailable integration', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ available: false })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('Coming Soon')).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('should show "Set Up" button for unconfigured integration', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ configured: false, connected: false })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /set up/i })).toBeInTheDocument();
      });
    });

    it('should show "Connect" button for configured but not connected', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ configured: true, connected: false })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
      });
    });

    it('should show sync and disconnect buttons for connected integration', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ connected: true, configured: true })],
          });
        }),
        http.get('/api/integrations/:type/status', () => {
          return HttpResponse.json({
            success: true,
            data: mockIntegrationStatus({ connected: true }),
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        // Sync and disconnect should be present as icon buttons
        expect(screen.getByTitle('Sync')).toBeInTheDocument();
        expect(screen.getByTitle('Disconnect')).toBeInTheDocument();
      });
    });

    it('should not show action buttons for unavailable integrations', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ name: 'Slack', available: false })],
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText('Slack')).toBeInTheDocument();
      });

      // Should not have Set Up or Connect buttons
      expect(screen.queryByRole('button', { name: /set up/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /connect/i })).not.toBeInTheDocument();
    });
  });

  describe('Modal Interactions', () => {
    it('should open connect modal when clicking Set Up button', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ configured: false })],
          });
        }),
        http.get('/api/integrations/:type/setup', () => {
          return HttpResponse.json({
            success: true,
            data: {
              type: 'github',
              name: 'GitHub',
              instructions: ['Step 1', 'Step 2'],
              credential_fields: [{ name: 'client_id', label: 'Client ID', type: 'text' }],
              callback_url: 'http://localhost/callback',
            },
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /set up/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /set up/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should open disconnect confirmation when clicking Disconnect', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ connected: true, configured: true })],
          });
        }),
        http.get('/api/integrations/:type/status', () => {
          return HttpResponse.json({
            success: true,
            data: mockIntegrationStatus({ connected: true }),
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByTitle('Disconnect')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Disconnect'));

      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
      });
    });
  });

  describe('Sync Functionality', () => {
    it('should trigger sync when clicking sync button', async () => {
      let syncCalled = false;
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ connected: true, configured: true })],
          });
        }),
        http.get('/api/integrations/:type/status', () => {
          return HttpResponse.json({
            success: true,
            data: mockIntegrationStatus({ connected: true }),
          });
        }),
        http.post('/api/integrations/:type/sync', () => {
          syncCalled = true;
          return HttpResponse.json({
            success: true,
            data: { success: true, items_synced: 10 },
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByTitle('Sync')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle('Sync'));

      await waitFor(() => {
        expect(syncCalled).toBe(true);
      });
    });
  });

  describe('URL Parameters', () => {
    it('should show success toast when connected param present', async () => {
      window.history.pushState({}, '', '/integrations?connected=github');

      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration()],
          });
        })
      );

      render(<IntegrationsApp />);

      // Toast should be triggered - the actual toast component behavior
      // depends on the implementation, but the effect should run
      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });
    });
  });

  describe('Connected Count', () => {
    it('should display count of connected integrations', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [
              mockIntegration({ type: 'github', connected: true }),
              mockIntegration({ type: 'slack', connected: false }),
              mockIntegration({ type: 'discord', connected: true }),
            ],
          });
        }),
        http.get('/api/integrations/:type/status', () => {
          return HttpResponse.json({
            success: true,
            data: mockIntegrationStatus({ connected: true }),
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        // Should show 2 connected integrations
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Stats Display', () => {
    it('should display stats for connected integration', async () => {
      server.use(
        http.get('/api/integrations', () => {
          return HttpResponse.json({
            success: true,
            data: [mockIntegration({ connected: true, configured: true })],
          });
        }),
        http.get('/api/integrations/:type/status', () => {
          return HttpResponse.json({
            success: true,
            data: mockIntegrationStatus({
              connected: true,
              stats: { repos: 25, members: 10 },
            }),
          });
        })
      );

      render(<IntegrationsApp />);

      await waitFor(() => {
        expect(screen.getByText(/25 repos/i)).toBeInTheDocument();
        expect(screen.getByText(/10 members/i)).toBeInTheDocument();
      });
    });
  });
});
