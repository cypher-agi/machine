import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import {
  getMachines,
  getMachine,
  createMachine,
  rebootMachine,
  destroyMachine,
  getAgentMetrics,
  getMachineServices,
  restartMachineService,
  getMachineNetworking,
  syncMachines,
  getProviders,
  getProviderOptions,
  getProviderAccounts,
  getProviderAccount,
  createProviderAccount,
  verifyProviderAccount,
  updateProviderAccount,
  deleteProviderAccount,
  getDeployments,
  getDeployment,
  cancelDeployment,
  approveDeployment,
  getDeploymentLogs,
  getBootstrapProfiles,
  getBootstrapProfile,
  createBootstrapProfile,
  updateBootstrapProfile,
  deleteBootstrapProfile,
  getFirewallProfiles,
  getAuditEvents,
  getSSHKeys,
  getSSHKey,
  generateSSHKey,
  importSSHKey,
  getSSHKeyPrivate,
  syncSSHKeyToProvider,
  unsyncSSHKeyFromProvider,
  updateSSHKey,
  deleteSSHKey,
} from './api';

describe('API Client', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('buildQueryString', () => {
    it('should build query string from params', async () => {
      const machines = await getMachines({ status: 'running', provider: 'digitalocean' });
      expect(machines).toBeDefined();
      expect(Array.isArray(machines)).toBe(true);
    });

    it('should handle empty filter values', async () => {
      const machines = await getMachines({ status: undefined, provider: '' });
      expect(machines).toBeDefined();
    });
  });

  describe('fetchApi', () => {
    it('should handle successful responses', async () => {
      const machines = await getMachines();
      expect(machines).toBeDefined();
      expect(Array.isArray(machines)).toBe(true);
    });

    it('should throw error on API failure', async () => {
      server.use(
        http.get('/api/machines', () => {
          return HttpResponse.json({
            success: false,
            error: { code: 'TEST_ERROR', message: 'Test error message' },
          });
        })
      );

      await expect(getMachines()).rejects.toThrow('Test error message');
    });

    it('should include Content-Type header', async () => {
      let capturedHeaders: Headers | undefined;
      server.use(
        http.get('/api/machines', ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({ success: true, data: [] });
        })
      );

      await getMachines();
      expect(capturedHeaders?.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Machines API', () => {
    it('getMachines should return machine list', async () => {
      const machines = await getMachines();
      expect(machines).toHaveLength(1);
      expect(machines[0]).toHaveProperty('machine_id');
    });

    it('getMachine should return single machine', async () => {
      const machine = await getMachine('test-123');
      expect(machine).toHaveProperty('machine_id', 'test-123');
    });

    it('createMachine should return machine and deployment', async () => {
      const result = await createMachine({
        name: 'New Machine',
        provider_account_id: 'account-1',
        region: 'nyc1',
        size: 's-1vcpu-1gb',
        image: 'ubuntu-22-04-x64',
      });
      expect(result).toHaveProperty('machine');
      expect(result).toHaveProperty('deployment');
      expect(result.machine.name).toBe('New Machine');
    });

    it('rebootMachine should return deployment', async () => {
      const result = await rebootMachine('machine-1');
      expect(result).toHaveProperty('deployment');
      expect(result.deployment.type).toBe('reboot');
    });

    it('destroyMachine should return deployment', async () => {
      const result = await destroyMachine('machine-1');
      expect(result).toHaveProperty('deployment');
      expect(result.deployment.type).toBe('destroy');
    });

    it('getAgentMetrics should return metrics or null', async () => {
      const metrics = await getAgentMetrics('machine-1');
      expect(metrics).toHaveProperty('machine_id');
      expect(metrics).toHaveProperty('load_average');
    });

    it('getMachineServices should return services response', async () => {
      const result = await getMachineServices('machine-1');
      expect(result).toHaveProperty('services');
      expect(Array.isArray(result.services)).toBe(true);
    });

    it('restartMachineService should return result', async () => {
      const result = await restartMachineService('machine-1', 'nginx');
      expect(result).toHaveProperty('service_name', 'nginx');
      expect(result).toHaveProperty('deployment');
    });

    it('getMachineNetworking should return networking info', async () => {
      const result = await getMachineNetworking('machine-1');
      expect(result).toHaveProperty('interfaces');
      expect(result).toHaveProperty('dns');
    });

    it('syncMachines should return sync results', async () => {
      const result = await syncMachines();
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('results');
    });
  });

  describe('Providers API', () => {
    it('getProviders should return provider types', async () => {
      const providers = await getProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.find((p) => p.type === 'digitalocean')).toBeDefined();
    });

    it('getProviderOptions should return options', async () => {
      const options = await getProviderOptions('digitalocean');
      expect(options).toHaveProperty('regions');
      expect(options).toHaveProperty('sizes');
      expect(options).toHaveProperty('images');
    });

    it('getProviderAccounts should return accounts list', async () => {
      const accounts = await getProviderAccounts();
      expect(Array.isArray(accounts)).toBe(true);
    });

    it('getProviderAccount should return single account', async () => {
      const account = await getProviderAccount('account-1');
      expect(account).toHaveProperty('provider_account_id', 'account-1');
    });

    it('createProviderAccount should create account', async () => {
      const account = await createProviderAccount('digitalocean', {
        label: 'New Account',
        credentials: { api_token: 'test-token' },
      });
      expect(account).toHaveProperty('label', 'New Account');
    });

    it('verifyProviderAccount should verify credentials', async () => {
      const account = await verifyProviderAccount('account-1');
      expect(account).toHaveProperty('credential_status', 'valid');
    });

    it('updateProviderAccount should update account', async () => {
      const account = await updateProviderAccount('account-1', { label: 'Updated' });
      expect(account).toHaveProperty('label', 'Updated');
    });

    it('deleteProviderAccount should delete account', async () => {
      const result = await deleteProviderAccount('account-1');
      expect(result).toHaveProperty('deleted', true);
    });
  });

  describe('Deployments API', () => {
    it('getDeployments should return deployment list', async () => {
      const deployments = await getDeployments();
      expect(Array.isArray(deployments)).toBe(true);
    });

    it('getDeployment should return single deployment', async () => {
      const deployment = await getDeployment('deployment-1');
      expect(deployment).toHaveProperty('deployment_id', 'deployment-1');
    });

    it('cancelDeployment should cancel deployment', async () => {
      const deployment = await cancelDeployment('deployment-1');
      expect(deployment).toHaveProperty('state', 'cancelled');
    });

    it('approveDeployment should approve deployment', async () => {
      const deployment = await approveDeployment('deployment-1');
      expect(deployment).toHaveProperty('state', 'in_progress');
    });

    it('getDeploymentLogs should return logs', async () => {
      const logs = await getDeploymentLogs('deployment-1');
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Bootstrap API', () => {
    it('getBootstrapProfiles should return profiles', async () => {
      const profiles = await getBootstrapProfiles();
      expect(Array.isArray(profiles)).toBe(true);
    });

    it('getBootstrapProfile should return single profile', async () => {
      const profile = await getBootstrapProfile('profile-1');
      expect(profile).toHaveProperty('profile_id', 'profile-1');
    });

    it('createBootstrapProfile should create profile', async () => {
      const profile = await createBootstrapProfile({
        name: 'New Profile',
        method: 'cloud_init',
      });
      expect(profile).toHaveProperty('name', 'New Profile');
    });

    it('updateBootstrapProfile should update profile', async () => {
      const profile = await updateBootstrapProfile('profile-1', { name: 'Updated' });
      expect(profile).toHaveProperty('name', 'Updated');
    });

    it('deleteBootstrapProfile should delete profile', async () => {
      const result = await deleteBootstrapProfile('profile-1');
      expect(result).toHaveProperty('deleted', true);
    });

    it('getFirewallProfiles should return firewall profiles', async () => {
      const profiles = await getFirewallProfiles();
      expect(Array.isArray(profiles)).toBe(true);
    });
  });

  describe('Audit API', () => {
    it('getAuditEvents should return events', async () => {
      const events = await getAuditEvents();
      expect(Array.isArray(events)).toBe(true);
    });

    it('getAuditEvents should support filtering', async () => {
      const events = await getAuditEvents({ action: 'machine.create' });
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('SSH Keys API', () => {
    it('getSSHKeys should return keys list', async () => {
      const keys = await getSSHKeys();
      expect(Array.isArray(keys)).toBe(true);
    });

    it('getSSHKey should return single key', async () => {
      const key = await getSSHKey('key-1');
      expect(key).toHaveProperty('ssh_key_id', 'key-1');
    });

    it('generateSSHKey should generate new key', async () => {
      const result = await generateSSHKey({ name: 'New Key', type: 'ed25519' });
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('private_key');
    });

    it('importSSHKey should import existing key', async () => {
      const key = await importSSHKey({
        name: 'Imported Key',
        public_key: 'ssh-ed25519 AAAA...',
      });
      expect(key).toHaveProperty('name', 'Imported Key');
    });

    it('getSSHKeyPrivate should return private key', async () => {
      const result = await getSSHKeyPrivate('key-1');
      expect(result).toHaveProperty('private_key');
    });

    it('syncSSHKeyToProvider should sync key', async () => {
      const key = await syncSSHKeyToProvider('key-1', 'account-1');
      expect(key).toHaveProperty('provider_key_ids');
    });

    it('unsyncSSHKeyFromProvider should unsync key', async () => {
      const key = await unsyncSSHKeyFromProvider('key-1', 'digitalocean');
      expect(key).toHaveProperty('provider_key_ids');
    });

    it('updateSSHKey should update key', async () => {
      const key = await updateSSHKey('key-1', { name: 'Updated Key' });
      expect(key).toHaveProperty('name', 'Updated Key');
    });

    it('deleteSSHKey should delete key', async () => {
      const result = await deleteSSHKey('key-1');
      expect(result).toHaveProperty('deleted', true);
    });
  });
});
