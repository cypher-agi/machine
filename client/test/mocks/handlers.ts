import { http, HttpResponse } from 'msw';
import type {
  Machine,
  Deployment,
  ProviderAccount,
  BootstrapProfile,
  FirewallProfile,
  SSHKey,
  AuditEvent,
} from '@machina/shared';

const API_BASE = '/api';

// Mock data factories
export const mockMachine = (overrides: Partial<Machine> = {}): Machine => ({
  machine_id: 'machine-1',
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
  machine_id: 'machine-1',
  type: 'create',
  state: 'completed',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const mockProviderAccount = (overrides: Partial<ProviderAccount> = {}): ProviderAccount => ({
  provider_account_id: 'account-1',
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
];
