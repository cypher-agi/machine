import express, { type Express } from 'express';
import { vi } from 'vitest';

// Create a test Express app
export function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  return app;
}

// Mock database factory
export function createMockDatabase() {
  return {
    getMachines: vi.fn().mockReturnValue([]),
    getMachine: vi.fn(),
    insertMachine: vi.fn(),
    updateMachine: vi.fn(),
    deleteMachine: vi.fn(),
    getAgentMetrics: vi.fn(),
    updateAgentMetrics: vi.fn(),
    getDeployments: vi.fn().mockReturnValue([]),
    getDeploymentsByMachine: vi.fn().mockReturnValue([]),
    getDeployment: vi.fn(),
    insertDeployment: vi.fn(),
    updateDeployment: vi.fn(),
    getProviderAccounts: vi.fn().mockReturnValue([]),
    getProviderAccount: vi.fn(),
    insertProviderAccount: vi.fn(),
    updateProviderAccount: vi.fn(),
    deleteProviderAccount: vi.fn(),
    getCredentials: vi.fn(),
    storeCredentials: vi.fn(),
    deleteCredentials: vi.fn(),
    getBootstrapProfiles: vi.fn().mockReturnValue([]),
    getBootstrapProfile: vi.fn(),
    insertBootstrapProfile: vi.fn(),
    updateBootstrapProfile: vi.fn(),
    deleteBootstrapProfile: vi.fn(),
    getFirewallProfiles: vi.fn().mockReturnValue([]),
    getFirewallProfile: vi.fn(),
    insertFirewallProfile: vi.fn(),
    getAuditEvents: vi.fn().mockReturnValue([]),
    insertAuditEvent: vi.fn(),
    getSSHKeys: vi.fn().mockReturnValue([]),
    getSSHKey: vi.fn(),
    getSSHKeyByFingerprint: vi.fn(),
    insertSSHKey: vi.fn(),
    updateSSHKey: vi.fn(),
    deleteSSHKey: vi.fn(),
    getSSHKeyPrivateKey: vi.fn(),
    storeSSHKeyPrivateKey: vi.fn(),
    deleteSSHKeyPrivateKey: vi.fn(),
    close: vi.fn(),
  };
}

// Mock machine data
export const mockMachineData = {
  machine_id: 'test-machine-1',
  name: 'Test Machine',
  provider: 'digitalocean' as const,
  provider_account_id: 'account-1',
  region: 'nyc1',
  zone: null,
  size: 's-1vcpu-1gb',
  image: 'ubuntu-22-04-x64',
  desired_status: 'running' as const,
  actual_status: 'running' as const,
  public_ip: '192.168.1.1',
  private_ip: '10.0.0.1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tags: { env: 'test' },
};

// Mock deployment data
export const mockDeploymentData = {
  deployment_id: 'test-deployment-1',
  machine_id: 'test-machine-1',
  type: 'create' as const,
  state: 'completed' as const,
  created_at: new Date().toISOString(),
};

// Mock provider account data
export const mockProviderAccountData = {
  provider_account_id: 'test-account-1',
  provider_type: 'digitalocean' as const,
  label: 'Test Account',
  credential_status: 'valid' as const,
  created_at: new Date().toISOString(),
};

// Mock SSH key data
export const mockSSHKeyData = {
  ssh_key_id: 'test-key-1',
  name: 'Test Key',
  fingerprint: 'SHA256:abc123def456',
  public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest test@example.com',
  key_type: 'ed25519' as const,
  key_bits: 256,
  provider_key_ids: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock bootstrap profile data
export const mockBootstrapProfileData = {
  profile_id: 'test-profile-1',
  name: 'Test Profile',
  description: 'A test profile',
  method: 'cloud_init' as const,
  services_to_run: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_system_profile: false,
};

// Mock audit event data
export const mockAuditEventData = {
  event_id: 'test-event-1',
  action: 'machine.create',
  outcome: 'success' as const,
  timestamp: new Date().toISOString(),
};
