import { database } from './database';
import {
  TerraformService,
  getCredentials,
  type LogCallback,
  type TerraformVars,
} from './terraform';
import type {
  Machine,
  Deployment,
  DeploymentLog,
  SSHKey,
  FirewallProfile,
  MachineStatus,
} from '@machina/shared';

// Store for active deployment log listeners
const deploymentLogListeners: Map<string, LogCallback[]> = new Map();

export function addDeploymentLogListener(deploymentId: string, listener: LogCallback): void {
  const listeners = deploymentLogListeners.get(deploymentId) || [];
  listeners.push(listener);
  deploymentLogListeners.set(deploymentId, listeners);
}

export function removeDeploymentLogListener(deploymentId: string, listener: LogCallback): void {
  const listeners = deploymentLogListeners.get(deploymentId) || [];
  const index = listeners.indexOf(listener);
  if (index > -1) {
    listeners.splice(index, 1);
  }
}

interface TerraformCreateOptions {
  machine: Machine;
  deployment: Deployment;
  credentials: Record<string, string>;
  providerType: string;
  cloudInitTemplate?: string | undefined;
  firewallProfile?: FirewallProfile | undefined;
  sshKeys?: SSHKey[] | undefined;
}

export async function runTerraformCreate({
  machine,
  deployment,
  credentials,
  providerType,
  cloudInitTemplate,
  firewallProfile,
  sshKeys,
}: TerraformCreateOptions): Promise<void> {
  const logListeners = deploymentLogListeners.get(deployment.deployment_id) || [];
  const deploymentLogs: DeploymentLog[] = [];

  const onLog: LogCallback = (log) => {
    const logEntry: DeploymentLog = {
      deployment_id: deployment.deployment_id,
      ...log,
      timestamp: new Date().toISOString(),
    };

    // Store log for persistence
    deploymentLogs.push(logEntry);

    // Persist logs to database
    database.updateDeployment({
      deployment_id: deployment.deployment_id,
      logs: deploymentLogs,
    });

    // Send to connected listeners
    logListeners.forEach((listener) => listener(log));
  };

  if (!machine.terraform_workspace) {
    throw new Error('Machine does not have a terraform workspace');
  }

  const tf = new TerraformService(machine.terraform_workspace, onLog);

  try {
    // Determine module based on provider
    let modulePath: string;
    let vars: TerraformVars;

    if (providerType === 'digitalocean') {
      modulePath = 'digitalocean';

      // Convert firewall profile rules to Terraform format
      let firewallEnabled = false;
      let firewallInboundRules: {
        protocol: string;
        port_range: string;
        source_addresses: string[];
      }[] = [];

      if (firewallProfile?.rules && firewallProfile.rules.length > 0) {
        firewallEnabled = true;
        firewallInboundRules = firewallProfile.rules
          .filter((rule) => rule.direction === 'inbound')
          .map((rule) => ({
            protocol: rule.protocol,
            port_range:
              rule.port_range_start === rule.port_range_end
                ? String(rule.port_range_start)
                : `${rule.port_range_start}-${rule.port_range_end}`,
            source_addresses: rule.source_addresses || ['0.0.0.0/0', '::/0'],
          }));

        onLog({
          level: 'info',
          message: `Firewall profile "${firewallProfile.name}" will be applied with ${firewallInboundRules.length} inbound rules`,
          source: 'system',
        });
      } else {
        // Default: just SSH if no firewall profile
        firewallEnabled = true;
        firewallInboundRules = [
          { protocol: 'tcp', port_range: '22', source_addresses: ['0.0.0.0/0', '::/0'] },
        ];
        onLog({
          level: 'info',
          message: 'No firewall profile selected, applying default SSH-only rules',
          source: 'system',
        });
      }

      // Collect SSH key IDs from provider_key_ids for DigitalOcean
      const sshKeyIds: string[] = [];
      if (sshKeys && sshKeys.length > 0) {
        for (const key of sshKeys) {
          if (key.provider_key_ids.digitalocean) {
            sshKeyIds.push(key.provider_key_ids.digitalocean);
            onLog({
              level: 'info',
              message: `SSH key "${key.name}" will be attached (DO ID: ${key.provider_key_ids.digitalocean})`,
              source: 'system',
            });
          } else {
            onLog({
              level: 'warn',
              message: `SSH key "${key.name}" not synced to DigitalOcean - skipping`,
              source: 'system',
            });
          }
        }
      }

      const apiToken = credentials.api_token;
      if (!apiToken) {
        throw new Error('Missing api_token in credentials');
      }
      vars = {
        do_token: apiToken,
        name: machine.name,
        machine_id: machine.machine_id,
        region: machine.region,
        size: machine.size,
        image: machine.image,
        ssh_keys: sshKeyIds,
        tags: Object.entries(machine.tags).map(([k, v]) => `${k}:${v}`),
        user_data: cloudInitTemplate || '',
        firewall_enabled: firewallEnabled,
        firewall_inbound_rules: firewallInboundRules,
      };

      if (cloudInitTemplate) {
        onLog({
          level: 'info',
          message: 'Bootstrap profile cloud-init will be applied to the machine',
          source: 'system',
        });
        // Log first few lines of cloud-init for debugging
        const cloudInitLines = cloudInitTemplate.split('\n').slice(0, 20);
        onLog({
          level: 'debug',
          message: `Cloud-init preview:\n${cloudInitLines.join('\n')}${cloudInitTemplate.split('\n').length > 20 ? '\n... (truncated)' : ''}`,
          source: 'system',
        });
      }
    } else if (providerType === 'aws') {
      // TODO: Add AWS module
      throw new Error('AWS provider not yet implemented');
    } else {
      throw new Error(`Unsupported provider: ${providerType}`);
    }

    // Initialize
    onLog({ level: 'info', message: 'Initializing Terraform...', source: 'system' });
    const initSuccess = await tf.init(modulePath);
    if (!initSuccess) {
      throw new Error('Terraform init failed');
    }

    // Plan
    deployment.state = 'planning';
    onLog({ level: 'info', message: 'Creating execution plan...', source: 'system' });
    const planResult = await tf.plan(vars);
    if (!planResult.success) {
      throw new Error('Terraform plan failed');
    }

    deployment.plan_summary = {
      resources_to_add: 2, // droplet + firewall
      resources_to_change: 0,
      resources_to_destroy: 0,
      resource_changes: [
        {
          address: 'digitalocean_droplet.main',
          action: 'create',
          resource_type: 'digitalocean_droplet',
          resource_name: 'main',
        },
        {
          address: 'digitalocean_firewall.main',
          action: 'create',
          resource_type: 'digitalocean_firewall',
          resource_name: 'main',
        },
      ],
    };

    // Apply
    deployment.state = 'applying';
    onLog({ level: 'info', message: 'Applying changes...', source: 'system' });
    const applyResult = await tf.apply(planResult.planFile);

    if (applyResult.success && applyResult.outputs) {
      // Update machine with real values
      const outputs = applyResult.outputs;
      database.updateMachine({
        machine_id: machine.machine_id,
        ...(typeof outputs.public_ip === 'string' && { public_ip: outputs.public_ip }),
        ...(typeof outputs.private_ip === 'string' && { private_ip: outputs.private_ip }),
        provider_resource_id: String(outputs.droplet_id),
        actual_status: 'running',
        terraform_state_status: 'in_sync',
        updated_at: new Date().toISOString(),
      });

      database.updateDeployment({
        deployment_id: deployment.deployment_id,
        state: 'succeeded',
        finished_at: new Date().toISOString(),
        outputs: applyResult.outputs,
      });

      onLog({
        level: 'info',
        message: `✓ Machine created successfully! IP: ${applyResult.outputs.public_ip}`,
        source: 'system',
      });
    } else {
      throw new Error(applyResult.error || 'Apply failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Terraform error:', error);
    database.updateMachine({
      machine_id: machine.machine_id,
      actual_status: 'error',
      terraform_state_status: 'unknown',
      updated_at: new Date().toISOString(),
    });

    database.updateDeployment({
      deployment_id: deployment.deployment_id,
      state: 'failed',
      finished_at: new Date().toISOString(),
      error_message: errorMessage,
    });

    onLog({ level: 'error', message: `Deployment failed: ${errorMessage}`, source: 'system' });
  }
}

export async function runTerraformDestroy(
  machineId: string,
  workspace: string | undefined,
  deploymentId: string
): Promise<void> {
  const tf = new TerraformService(workspace || machineId);

  try {
    const result = await tf.destroy();

    if (result.success) {
      database.updateMachine({
        machine_id: machineId,
        actual_status: 'terminated',
        terraform_state_status: 'in_sync',
        updated_at: new Date().toISOString(),
      });

      database.updateDeployment({
        deployment_id: deploymentId,
        state: 'succeeded',
        finished_at: new Date().toISOString(),
      });

      // Clean up workspace
      tf.cleanup();
    } else {
      throw new Error(result.error || 'Destroy failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    database.updateMachine({
      machine_id: machineId,
      actual_status: 'error',
      updated_at: new Date().toISOString(),
    });

    database.updateDeployment({
      deployment_id: deploymentId,
      state: 'failed',
      finished_at: new Date().toISOString(),
      error_message: errorMessage,
    });
  }
}

export async function runReboot(
  machineId: string,
  resourceId: string,
  deploymentId: string,
  credentials: Record<string, string>
): Promise<void> {
  try {
    const response = await fetch(`https://api.digitalocean.com/v2/droplets/${resourceId}/actions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'reboot' }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || 'Reboot API call failed');
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.digitalocean.com/v2/droplets/${resourceId}`, {
        headers: {
          Authorization: `Bearer ${credentials.api_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (statusResponse.ok) {
        const data = (await statusResponse.json()) as { droplet: { status: string } };
        if (data.droplet.status === 'active') {
          database.updateMachine({
            machine_id: machineId,
            actual_status: 'running',
            updated_at: new Date().toISOString(),
          });
          database.updateDeployment({
            deployment_id: deploymentId,
            state: 'succeeded',
            finished_at: new Date().toISOString(),
          });
          return;
        }
      }
      attempts++;
    }

    throw new Error('Reboot timed out');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    database.updateMachine({
      machine_id: machineId,
      actual_status: 'error',
      updated_at: new Date().toISOString(),
    });
    database.updateDeployment({
      deployment_id: deploymentId,
      state: 'failed',
      finished_at: new Date().toISOString(),
      error_message: errorMessage,
    });
  }
}

interface DropletNetwork {
  ip_address: string;
  type: string;
}

interface DropletInfo {
  id: number;
  name: string;
  status: string;
  networks: {
    v4: DropletNetwork[];
  };
}

interface SyncResult {
  machine_id: string;
  name: string;
  previous_status: string;
  new_status: string;
  action: string;
}

export async function syncMachinesWithProvider(): Promise<{
  synced: number;
  results: SyncResult[];
}> {
  const machines = database.getMachines();
  const results: SyncResult[] = [];

  // Group machines by provider account
  const machinesByAccount = new Map<string, Machine[]>();
  for (const machine of machines) {
    // Skip already terminated machines
    if (machine.actual_status === 'terminated') continue;

    const existing = machinesByAccount.get(machine.provider_account_id) || [];
    existing.push(machine);
    machinesByAccount.set(machine.provider_account_id, existing);
  }

  for (const [accountId, accountMachines] of machinesByAccount) {
    const credentials = getCredentials(accountId);
    if (!credentials) {
      // Mark machines as unknown if we can't check
      for (const machine of accountMachines) {
        results.push({
          machine_id: machine.machine_id,
          name: machine.name,
          previous_status: machine.actual_status,
          new_status: machine.actual_status,
          action: 'skipped_no_credentials',
        });
      }
      continue;
    }

    const providerAccount = database.getProviderAccount(accountId);
    if (!providerAccount) continue;

    if (providerAccount.provider_type === 'digitalocean') {
      try {
        // Fetch all droplets from DigitalOcean
        const response = await fetch('https://api.digitalocean.com/v2/droplets?per_page=200', {
          headers: {
            Authorization: `Bearer ${credentials.api_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`DigitalOcean API error: ${response.status}`);
        }

        const data = (await response.json()) as { droplets: DropletInfo[] };
        const providerDroplets = new Map<string, DropletInfo>();

        for (const droplet of data.droplets) {
          providerDroplets.set(String(droplet.id), droplet);
        }

        // Check each machine against provider state
        for (const machine of accountMachines) {
          const previousStatus = machine.actual_status;

          if (!machine.provider_resource_id) {
            // Machine never got a provider resource ID - likely failed during creation
            if (machine.actual_status === 'provisioning' || machine.actual_status === 'pending') {
              database.updateMachine({
                machine_id: machine.machine_id,
                actual_status: 'error',
                terraform_state_status: 'unknown',
                updated_at: new Date().toISOString(),
              });
              results.push({
                machine_id: machine.machine_id,
                name: machine.name,
                previous_status: previousStatus,
                new_status: 'error',
                action: 'marked_error_no_resource_id',
              });
            }
            continue;
          }

          const droplet = providerDroplets.get(machine.provider_resource_id);

          if (!droplet) {
            // Droplet no longer exists at provider
            database.updateMachine({
              machine_id: machine.machine_id,
              actual_status: 'terminated',
              terraform_state_status: 'drifted',
              updated_at: new Date().toISOString(),
            });
            results.push({
              machine_id: machine.machine_id,
              name: machine.name,
              previous_status: previousStatus,
              new_status: 'terminated',
              action: 'marked_terminated_not_found',
            });
          } else {
            // Droplet exists - sync status
            let newStatus: MachineStatus;
            switch (droplet.status) {
              case 'active':
                newStatus = 'running';
                break;
              case 'off':
                newStatus = 'stopped';
                break;
              case 'new':
                newStatus = 'provisioning';
                break;
              default:
                newStatus = machine.actual_status;
            }

            // Update IP addresses if changed
            const publicIp = droplet.networks?.v4?.find((n) => n.type === 'public')?.ip_address;
            const privateIp = droplet.networks?.v4?.find((n) => n.type === 'private')?.ip_address;

            if (
              newStatus !== previousStatus ||
              publicIp !== machine.public_ip ||
              privateIp !== machine.private_ip
            ) {
              database.updateMachine({
                machine_id: machine.machine_id,
                actual_status: newStatus,
                ...((publicIp || machine.public_ip) && {
                  public_ip: publicIp || machine.public_ip,
                }),
                ...((privateIp || machine.private_ip) && {
                  private_ip: privateIp || machine.private_ip,
                }),
                terraform_state_status: 'in_sync',
                updated_at: new Date().toISOString(),
              });
              results.push({
                machine_id: machine.machine_id,
                name: machine.name,
                previous_status: previousStatus,
                new_status: newStatus,
                action: newStatus !== previousStatus ? 'status_updated' : 'ip_updated',
              });
            } else {
              results.push({
                machine_id: machine.machine_id,
                name: machine.name,
                previous_status: previousStatus,
                new_status: newStatus,
                action: 'no_change',
              });
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Sync error for account', accountId, error);
        for (const machine of accountMachines) {
          results.push({
            machine_id: machine.machine_id,
            name: machine.name,
            previous_status: machine.actual_status,
            new_status: machine.actual_status,
            action: `sync_error: ${errorMessage}`,
          });
        }
      }
    }
  }

  return {
    synced: results.filter((r) => r.action !== 'no_change' && !r.action.startsWith('skipped'))
      .length,
    results,
  };
}
