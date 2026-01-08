import { http, HttpResponse } from 'msw';
import type {
  Machine,
  Deployment,
  ProviderAccount,
  BootstrapProfile,
  FirewallProfile,
  SSHKey,
  AuditEvent,
  TeamWithMembership,
  TeamDetailResponse,
  TeamMember,
  TeamInvite,
  IntegrationListItem,
  IntegrationStatusResponse,
  IntegrationSetupInfo,
  GitHubRepository,
  GitHubMember,
} from '@machina/shared';

const API_BASE = '/api';

// Mock data factories
export const mockMachine = (overrides: Partial<Machine> = {}): Machine => ({
  machine_id: 'machine-1',
  team_id: 'team-1',
  name: 'Test Machine',
  provider: 'digitalocean',
  provider_account_id: 'account-1',
  region: 'nyc1',
  size: 's-1vcpu-1gb',
  image: 'ubuntu-22-04-x64',
  desired_status: 'running',
  actual_status: 'running',
  public_ip: '192.168.1.1',
  private_ip: '10.0.0.1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tags: { env: 'test' },
  ...overrides,
});

export const mockDeployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  deployment_id: 'deployment-1',
  team_id: 'team-1',
  machine_id: 'machine-1',
  type: 'create',
  state: 'completed',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockProviderAccount = (overrides: Partial<ProviderAccount> = {}): ProviderAccount => ({
  provider_account_id: 'account-1',
  team_id: 'team-1',
  provider_type: 'digitalocean',
  label: 'Test Account',
  credential_status: 'valid',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockBootstrapProfile = (
  overrides: Partial<BootstrapProfile> = {}
): BootstrapProfile => ({
  profile_id: 'profile-1',
  team_id: 'team-1',
  name: 'Test Profile',
  description: 'Test bootstrap profile',
  method: 'cloud_init',
  services_to_run: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_system_profile: false,
  ...overrides,
});

export const mockFirewallProfile = (overrides: Partial<FirewallProfile> = {}): FirewallProfile => ({
  profile_id: 'fw-1',
  name: 'Test Firewall',
  rules: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const mockSSHKey = (overrides: Partial<SSHKey> = {}): SSHKey => ({
  ssh_key_id: 'key-1',
  team_id: 'team-1',
  name: 'Test Key',
  fingerprint: 'SHA256:abc123',
  public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest test@example.com',
  key_type: 'ed25519',
  key_bits: 256,
  provider_key_ids: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const mockAuditEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  event_id: 'event-1',
  action: 'machine.create',
  outcome: 'success',
  timestamp: new Date().toISOString(),
  ...overrides,
});

// Teams mock factories
export const mockTeam = (overrides: Partial<TeamWithMembership> = {}): TeamWithMembership => ({
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

export const mockTeamMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  team_member_id: 'tmem-1',
  team_id: 'team-1',
  user_id: 'user-1',
  role: 'admin',
  joined_at: new Date().toISOString(),
  ...overrides,
});

export const mockTeamInvite = (overrides: Partial<TeamInvite> = {}): TeamInvite => ({
  invite_id: 'inv-1',
  team_id: 'team-1',
  invite_code: 'ABC123XYZ',
  created_by: 'user-1',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

// Integrations mock factories
export const mockIntegration = (
  overrides: Partial<IntegrationListItem> = {}
): IntegrationListItem => ({
  type: 'github',
  name: 'GitHub',
  description: 'Import repositories and team members from GitHub',
  icon: 'github',
  features: ['repos', 'members'],
  available: true,
  connected: false,
  configured: false,
  ...overrides,
});

export const mockIntegrationStatus = (
  overrides: Partial<IntegrationStatusResponse> = {}
): IntegrationStatusResponse => ({
  connected: false,
  configured: false,
  definition: {
    type: 'github',
    name: 'GitHub',
    description: 'Import repositories and team members',
    icon: 'github',
    features: ['repos', 'members'],
    available: true,
  },
  ...overrides,
});

export const mockGitHubRepo = (overrides: Partial<GitHubRepository> = {}): GitHubRepository => ({
  repo_id: 'ghr_1',
  team_id: 'team-1',
  integration_id: 'int-1',
  github_repo_id: 12345,
  name: 'test-repo',
  full_name: 'testorg/test-repo',
  private: false,
  archived: false,
  disabled: false,
  default_branch: 'main',
  html_url: 'https://github.com/testorg/test-repo',
  sync_status: 'ok',
  imported_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const mockGitHubMember = (overrides: Partial<GitHubMember> = {}): GitHubMember => ({
  member_id: 'ghm_1',
  team_id: 'team-1',
  integration_id: 'int-1',
  github_user_id: 67890,
  login: 'testuser',
  avatar_url: 'https://avatars.githubusercontent.com/u/67890',
  html_url: 'https://github.com/testuser',
  organization: 'testorg',
  role: 'member',
  sync_status: 'ok',
  imported_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Default handlers
export const handlers = [
  // Machines
  http.get(`${API_BASE}/machines`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockMachine()],
    });
  }),

  http.get(`${API_BASE}/machines/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockMachine({ machine_id: params.id as string }),
    });
  }),

  http.post(`${API_BASE}/machines`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: {
        machine: mockMachine({ name: (body as { name?: string }).name }),
        deployment: mockDeployment({ state: 'pending' }),
      },
    });
  }),

  http.post(`${API_BASE}/machines/:id/reboot`, () => {
    return HttpResponse.json({
      success: true,
      data: { deployment: mockDeployment({ type: 'reboot' }) },
    });
  }),

  http.post(`${API_BASE}/machines/:id/destroy`, () => {
    return HttpResponse.json({
      success: true,
      data: { deployment: mockDeployment({ type: 'destroy' }) },
    });
  }),

  http.get(`${API_BASE}/machines/:id/services`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        services: [{ name: 'nginx', status: 'running', active: true, enabled: true }],
      },
    });
  }),

  http.post(`${API_BASE}/machines/:id/services/:name/restart`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        service_name: params.name,
        deployment: mockDeployment({ type: 'service_restart' }),
      },
    });
  }),

  http.get(`${API_BASE}/machines/:id/networking`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        interfaces: [
          { name: 'eth0', type: 'public', ipv4: '192.168.1.1', mac: '00:00:00:00:00:01' },
        ],
        dns: { nameservers: ['8.8.8.8'] },
      },
    });
  }),

  http.post(`${API_BASE}/machines/sync`, () => {
    return HttpResponse.json({
      success: true,
      data: { synced: 1, results: [] },
    });
  }),

  // Agent metrics
  http.get(`${API_BASE}/agent/metrics/:machineId`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        machine_id: 'machine-1',
        agent_version: '1.0.0',
        hostname: 'test-host',
        uptime_seconds: 3600,
        load_average: [0.1, 0.2, 0.3],
        memory_total_mb: 1024,
        memory_used_mb: 512,
        disk_total_gb: 50,
        disk_used_gb: 25,
        last_heartbeat: new Date().toISOString(),
      },
    });
  }),

  // Providers
  http.get(`${API_BASE}/providers`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        { type: 'digitalocean', name: 'DigitalOcean', supported: true },
        { type: 'hetzner', name: 'Hetzner', supported: true },
        { type: 'aws', name: 'Amazon Web Services', supported: false },
      ],
    });
  }),

  http.get(`${API_BASE}/providers/:type/options`, ({ params: _params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        regions: [{ slug: 'nyc1', name: 'New York 1' }],
        sizes: [{ slug: 's-1vcpu-1gb', description: '1 vCPU, 1 GB RAM' }],
        images: [{ slug: 'ubuntu-22-04-x64', name: 'Ubuntu 22.04 (LTS) x64' }],
        credential_fields: [{ name: 'api_token', label: 'API Token', type: 'password' }],
      },
    });
  }),

  http.get(`${API_BASE}/providers/accounts`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockProviderAccount()],
    });
  }),

  http.get(`${API_BASE}/providers/accounts/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockProviderAccount({ provider_account_id: params.id as string }),
    });
  }),

  http.post(`${API_BASE}/providers/:type/accounts`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockProviderAccount({ label: (body as { label?: string }).label }),
    });
  }),

  http.post(`${API_BASE}/providers/accounts/:id/verify`, () => {
    return HttpResponse.json({
      success: true,
      data: mockProviderAccount({
        credential_status: 'valid',
        last_verified_at: new Date().toISOString(),
      }),
    });
  }),

  http.put(`${API_BASE}/providers/accounts/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockProviderAccount({
        provider_account_id: params.id as string,
        label: (body as { label?: string }).label,
      }),
    });
  }),

  http.delete(`${API_BASE}/providers/accounts/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: { deleted: true },
    });
  }),

  // Deployments
  http.get(`${API_BASE}/deployments`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockDeployment()],
    });
  }),

  http.get(`${API_BASE}/deployments/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockDeployment({ deployment_id: params.id as string }),
    });
  }),

  http.post(`${API_BASE}/deployments/:id/cancel`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockDeployment({ deployment_id: params.id as string, state: 'cancelled' }),
    });
  }),

  http.post(`${API_BASE}/deployments/:id/approve`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockDeployment({ deployment_id: params.id as string, state: 'in_progress' }),
    });
  }),

  http.get(`${API_BASE}/deployments/:id/logs`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Starting deployment',
          source: 'terraform',
        },
      ],
    });
  }),

  // Bootstrap
  http.get(`${API_BASE}/bootstrap/profiles`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockBootstrapProfile()],
    });
  }),

  http.get(`${API_BASE}/bootstrap/profiles/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockBootstrapProfile({ profile_id: params.id as string }),
    });
  }),

  http.post(`${API_BASE}/bootstrap/profiles`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockBootstrapProfile({ name: (body as { name?: string }).name }),
    });
  }),

  http.put(`${API_BASE}/bootstrap/profiles/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockBootstrapProfile({
        profile_id: params.id as string,
        name: (body as { name?: string }).name,
      }),
    });
  }),

  http.delete(`${API_BASE}/bootstrap/profiles/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: { deleted: true },
    });
  }),

  http.get(`${API_BASE}/bootstrap/firewall-profiles`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockFirewallProfile()],
    });
  }),

  // Audit
  http.get(`${API_BASE}/audit/events`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockAuditEvent()],
    });
  }),

  // SSH Keys
  http.get(`${API_BASE}/ssh/keys`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockSSHKey()],
    });
  }),

  http.get(`${API_BASE}/ssh/keys/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockSSHKey({ ssh_key_id: params.id as string }),
    });
  }),

  http.post(`${API_BASE}/ssh/keys/generate`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: {
        key: mockSSHKey({ name: (body as { name?: string }).name }),
        private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----',
      },
    });
  }),

  http.post(`${API_BASE}/ssh/keys/import`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockSSHKey({ name: (body as { name?: string }).name }),
    });
  }),

  http.get(`${API_BASE}/ssh/keys/:id/private`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----',
      },
    });
  }),

  http.post(`${API_BASE}/ssh/keys/:keyId/sync/:accountId`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockSSHKey({
        ssh_key_id: params.keyId as string,
        provider_key_ids: { digitalocean: 'do-key-123' },
      }),
    });
  }),

  http.delete(`${API_BASE}/ssh/keys/:keyId/sync/:provider`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockSSHKey({ ssh_key_id: params.keyId as string, provider_key_ids: {} }),
    });
  }),

  http.patch(`${API_BASE}/ssh/keys/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: mockSSHKey({
        ssh_key_id: params.id as string,
        name: (body as { name?: string }).name || 'Updated Key',
      }),
    });
  }),

  http.delete(`${API_BASE}/ssh/keys/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: { deleted: true },
    });
  }),

  // Teams
  http.get(`${API_BASE}/teams`, () => {
    return HttpResponse.json({
      success: true,
      data: [mockTeam()],
    });
  }),

  http.get(`${API_BASE}/teams/check-handle/:handle`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        handle: params.handle as string,
        available: true,
      },
    });
  }),

  http.post(`${API_BASE}/teams`, async ({ request }) => {
    const body = await request.json();
    const { name, handle } = body as { name: string; handle: string };
    return HttpResponse.json({
      success: true,
      data: mockTeam({ name, handle }),
    });
  }),

  http.get(`${API_BASE}/teams/:id`, ({ params }) => {
    const teamId = params.id as string;
    const response: TeamDetailResponse = {
      team: {
        team_id: teamId,
        name: 'Test Team',
        handle: 'test-team',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      },
      members: [
        mockTeamMember({ team_id: teamId }),
        mockTeamMember({ team_member_id: 'tmem-2', user_id: 'user-2', role: 'member' }),
      ],
      pending_invites: [mockTeamInvite({ team_id: teamId })],
      current_user_role: 'admin',
    };
    return HttpResponse.json({
      success: true,
      data: response,
    });
  }),

  http.put(`${API_BASE}/teams/:id`, async ({ request, params }) => {
    const body = await request.json();
    const { name, handle } = body as { name?: string; handle?: string };
    return HttpResponse.json({
      success: true,
      data: {
        team_id: params.id as string,
        name: name || 'Test Team',
        handle: handle || 'test-team',
        updated_at: new Date().toISOString(),
      },
    });
  }),

  http.delete(`${API_BASE}/teams/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: { deleted: true },
    });
  }),

  http.post(`${API_BASE}/teams/:id/invites`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockTeamInvite({ team_id: params.id as string }),
    });
  }),

  http.delete(`${API_BASE}/teams/:id/invites/:inviteId`, () => {
    return HttpResponse.json({
      success: true,
      data: { deleted: true },
    });
  }),

  http.post(`${API_BASE}/teams/join`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        member: mockTeamMember({ role: 'member' }),
        team: mockTeam(),
      },
    });
  }),

  http.delete(`${API_BASE}/teams/:id/members/:memberId`, () => {
    return HttpResponse.json({
      success: true,
      data: { deleted: true },
    });
  }),

  http.put(`${API_BASE}/teams/:id/members/:memberId`, async ({ request }) => {
    const body = await request.json();
    const { role } = body as { role: string };
    return HttpResponse.json({
      success: true,
      data: mockTeamMember({ role: role as 'admin' | 'member' }),
    });
  }),

  // Integrations
  http.get(`${API_BASE}/integrations`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockIntegration({ type: 'github', name: 'GitHub', available: true }),
        mockIntegration({
          type: 'slack',
          name: 'Slack',
          available: false,
          description: 'Send notifications to Slack',
        }),
      ],
    });
  }),

  http.get(`${API_BASE}/integrations/:type/setup`, ({ params }) => {
    const setupInfo: IntegrationSetupInfo = {
      type: params.type as 'github',
      name: params.type === 'github' ? 'GitHub' : 'Slack',
      instructions: [
        'Go to GitHub Developer Settings',
        'Create a new OAuth App',
        'Copy the Client ID and Client Secret',
        'Paste them below',
      ],
      credential_fields: [
        { name: 'client_id', label: 'Client ID', type: 'text', required: true },
        { name: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      ],
      callback_url: `http://localhost:5173/api/integrations/${params.type}/connect/callback`,
    };
    return HttpResponse.json({
      success: true,
      data: setupInfo,
    });
  }),

  http.post(`${API_BASE}/integrations/:type/configure`, () => {
    return HttpResponse.json({
      success: true,
      data: { configured: true },
    });
  }),

  http.delete(`${API_BASE}/integrations/:type/configure`, () => {
    return HttpResponse.json({
      success: true,
      data: { removed: true },
    });
  }),

  http.get(`${API_BASE}/integrations/:type/status`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockIntegrationStatus({
        connected: false,
        configured: false,
        definition: {
          type: params.type as 'github',
          name: params.type === 'github' ? 'GitHub' : 'Slack',
          description: 'Integration description',
          icon: params.type as string,
          features: ['feature1'],
          available: true,
        },
      }),
    });
  }),

  http.get(`${API_BASE}/integrations/:type/connect/start`, () => {
    return HttpResponse.json({
      success: true,
      data: { url: 'https://github.com/login/oauth/authorize?client_id=test' },
    });
  }),

  http.post(`${API_BASE}/integrations/:type/sync`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        started_at: new Date().toISOString(),
        items_synced: 10,
      },
    });
  }),

  http.delete(`${API_BASE}/integrations/:type`, () => {
    return HttpResponse.json({
      success: true,
      data: { disconnected: true },
    });
  }),

  // GitHub Data Endpoints
  http.get(`${API_BASE}/integrations/github/repos`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockGitHubRepo({ repo_id: 'ghr_1', name: 'repo-1', full_name: 'org/repo-1' }),
        mockGitHubRepo({
          repo_id: 'ghr_2',
          name: 'repo-2',
          full_name: 'org/repo-2',
          private: true,
        }),
      ],
    });
  }),

  http.get(`${API_BASE}/integrations/github/repos/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockGitHubRepo({ repo_id: params.id as string }),
    });
  }),

  http.get(`${API_BASE}/integrations/github/members`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        mockGitHubMember({ member_id: 'ghm_1', login: 'user1' }),
        mockGitHubMember({ member_id: 'ghm_2', login: 'user2', role: 'admin' }),
      ],
    });
  }),

  http.get(`${API_BASE}/integrations/github/members/:id`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: mockGitHubMember({ member_id: params.id as string }),
    });
  }),
];
