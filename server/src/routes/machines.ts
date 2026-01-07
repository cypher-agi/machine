import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../services/database';
import type {
  Machine,
  MachineCreateRequest,
  MachineListFilter,
  ApiResponse,
  Deployment,
  MachineServicesResponse,
  MachineNetworking,
  FirewallRule,
  SSHKey,
} from '@machina/shared';
import { AppError } from '../middleware/errorHandler';
import { getCredentials } from '../services/terraform';
import {
  runTerraformCreate,
  runTerraformDestroy,
  runReboot,
  syncMachinesWithProvider,
  addDeploymentLogListener,
  removeDeploymentLogListener,
} from '../services/machineOperations';

export const machinesRouter = Router();

// Re-export for deployment log streaming
export { addDeploymentLogListener, removeDeploymentLogListener };

// GET /machines - List machines with filtering
machinesRouter.get('/', (req: Request, res: Response) => {
  const teamId = req.teamId;
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const filters = {
    ...(req.query.status && { status: req.query.status as MachineListFilter['status'] }),
    ...(req.query.provider && { provider: req.query.provider as MachineListFilter['provider'] }),
    ...(req.query.region && { region: req.query.region as string }),
    ...(req.query.tag_key && { tag_key: req.query.tag_key as string }),
    ...(req.query.tag_value && { tag_value: req.query.tag_value as string }),
    ...(req.query.search && { search: req.query.search as string }),
  } as MachineListFilter;

  let filtered = database.getMachinesByTeam(teamId);

  // Apply filters
  if (filters.status) {
    filtered = filtered.filter((m) => m.actual_status === filters.status);
  }
  if (filters.provider) {
    filtered = filtered.filter((m) => m.provider === filters.provider);
  }
  if (filters.region) {
    filtered = filtered.filter((m) => m.region === filters.region);
  }
  if (filters.tag_key && filters.tag_value) {
    const tagKey = filters.tag_key;
    filtered = filtered.filter((m) => m.tags[tagKey] === filters.tag_value);
  }
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(search) ||
        m.public_ip?.includes(search) ||
        m.provider_resource_id?.includes(search)
    );
  }

  // Sorting
  const sortField = (req.query.sort_by as string) || 'created_at';
  const sortDir = (req.query.sort_dir as string) || 'desc';

  filtered.sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'status':
        comparison = a.actual_status.localeCompare(b.actual_status);
        break;
      case 'provider':
        comparison = a.provider.localeCompare(b.provider);
        break;
      case 'region':
        comparison = a.region.localeCompare(b.region);
        break;
      case 'created_at':
      default:
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortDir === 'desc' ? -comparison : comparison;
  });

  // Pagination
  const page = parseInt(req.query.page as string) || 1;
  const perPage = Math.min(parseInt(req.query.per_page as string) || 20, 100);
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedMachines = filtered.slice(startIndex, startIndex + perPage);

  const response: ApiResponse<Machine[]> = {
    success: true,
    data: paginatedMachines,
    meta: {
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      timestamp: new Date().toISOString(),
    },
  };

  res.json(response);
});

// GET /machines/:id - Get single machine
machinesRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const teamId = req.teamId;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing machine ID');
  }
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const machine = database.getMachineWithTeam(id, teamId);

  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${id} not found`);
  }

  const response: ApiResponse<Machine> = {
    success: true,
    data: machine,
  };

  res.json(response);
});

// POST /machines - Create new machine (with real Terraform!)
machinesRouter.post('/', async (req: Request, res: Response) => {
  const teamId = req.teamId;
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const body: MachineCreateRequest = req.body;

  // Validate required fields
  if (!body.name || !body.provider_account_id || !body.region || !body.size || !body.image) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields');
  }

  // Get provider account and verify team access
  const providerAccount = database.getProviderAccountWithTeam(body.provider_account_id, teamId);
  if (!providerAccount) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Provider account not found');
  }

  // Get credentials
  const credentials = getCredentials(body.provider_account_id);
  if (!credentials) {
    throw new AppError(
      400,
      'CREDENTIALS_NOT_FOUND',
      'No credentials found for this provider account. Please add your API token in Provider settings.'
    );
  }

  // Create new machine record
  const machineId = `mach_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
  const workspaceName = `machine-${machineId}`;

  const newMachine: Machine = {
    machine_id: machineId,
    team_id: teamId,
    name: body.name,
    provider: providerAccount.provider_type,
    provider_account_id: body.provider_account_id,
    region: body.region,
    ...(body.zone && { zone: body.zone }),
    size: body.size,
    image: body.image,
    desired_status: 'running',
    actual_status: 'provisioning',
    ...(body.vpc_id && { vpc_id: body.vpc_id }),
    ...(body.subnet_id && { subnet_id: body.subnet_id }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: body.tags || {},
    terraform_workspace: workspaceName,
    terraform_state_status: 'pending',
    provisioning_method: 'provider_api',
    ...(body.bootstrap_profile_id && { bootstrap_profile_id: body.bootstrap_profile_id }),
    ...(body.firewall_profile_id && { firewall_profile_id: body.firewall_profile_id }),
    agent_status: 'not_installed',
  };

  // Create deployment record - use authenticated user's ID
  const deploymentId = `deploy_${uuidv4().substring(0, 12)}`;
  const initiatedBy = req.user?.user_id || 'system';
  const deployment: Deployment = {
    deployment_id: deploymentId,
    team_id: teamId,
    machine_id: machineId,
    type: 'create',
    state: 'planning',
    terraform_workspace: workspaceName,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    initiated_by: initiatedBy,
  };

  // Save to database
  database.insertMachine(newMachine);
  database.insertDeployment(deployment);

  // Get bootstrap profile if specified
  const bootstrapProfile = body.bootstrap_profile_id
    ? database.getBootstrapProfile(body.bootstrap_profile_id)
    : undefined;

  // Get firewall profile if specified
  const firewallProfile = body.firewall_profile_id
    ? database.getFirewallProfile(body.firewall_profile_id)
    : undefined;

  // Get SSH keys if specified
  const sshKeys: SSHKey[] = [];
  if (body.ssh_key_ids && body.ssh_key_ids.length > 0) {
    for (const keyId of body.ssh_key_ids) {
      const key = database.getSSHKey(keyId);
      if (key) {
        sshKeys.push(key);
      }
    }
  }

  // Prepare cloud-init template with machine-specific values
  let cloudInitTemplate = bootstrapProfile?.cloud_init_template;
  if (cloudInitTemplate) {
    // Inject machine ID for agent heartbeat
    cloudInitTemplate = cloudInitTemplate.replace(/\{\{MACHINE_ID\}\}/g, machineId);
    // Inject server URL for agent communication
    const serverUrl = process.env.PUBLIC_SERVER_URL || 'http://localhost:3001';
    cloudInitTemplate = cloudInitTemplate.replace(/\{\{SERVER_URL\}\}/g, serverUrl);
  }

  // Start Terraform execution in background
  runTerraformCreate({
    machine: newMachine,
    deployment,
    credentials,
    providerType: providerAccount.provider_type,
    cloudInitTemplate,
    firewallProfile,
    sshKeys,
  }).catch((err) => {
    console.error('Terraform execution failed:', err);
  });

  const response: ApiResponse<{ machine: Machine; deployment: Deployment }> = {
    success: true,
    data: { machine: newMachine, deployment },
  };

  res.status(201).json(response);
});

// POST /machines/:id/reboot - Reboot machine via DigitalOcean API
machinesRouter.post('/:id/reboot', async (req: Request, res: Response) => {
  const { id } = req.params;
  const teamId = req.teamId;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing machine ID');
  }
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const machine = database.getMachineWithTeam(id, teamId);

  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${id} not found`);
  }

  if (machine.actual_status !== 'running') {
    throw new AppError(400, 'INVALID_STATE', 'Machine must be running to reboot');
  }

  if (!machine.provider_resource_id) {
    throw new AppError(400, 'NO_RESOURCE_ID', 'Machine has no provider resource ID');
  }

  const credentials = getCredentials(machine.provider_account_id);
  if (!credentials) {
    throw new AppError(
      400,
      'CREDENTIALS_NOT_FOUND',
      'No credentials found for this provider account'
    );
  }

  // Update machine status
  database.updateMachine({
    machine_id: machine.machine_id,
    actual_status: 'rebooting',
    updated_at: new Date().toISOString(),
  });

  // Create deployment for tracking - use authenticated user's ID
  const deployment: Deployment = {
    deployment_id: `deploy_${uuidv4().substring(0, 12)}`,
    team_id: teamId,
    machine_id: machine.machine_id,
    type: 'reboot',
    state: 'applying',
    terraform_workspace: machine.terraform_workspace,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    initiated_by: req.user?.user_id || 'system',
  };

  database.insertDeployment(deployment);

  // Call DigitalOcean API to reboot
  runReboot(
    machine.machine_id,
    machine.provider_resource_id,
    deployment.deployment_id,
    credentials
  ).catch((err) => {
    console.error('Reboot failed:', err);
  });

  const response: ApiResponse<{ deployment: Deployment }> = {
    success: true,
    data: { deployment },
  };

  res.json(response);
});

// POST /machines/:id/destroy - Destroy machine (with real Terraform!)
machinesRouter.post('/:id/destroy', async (req: Request, res: Response) => {
  const { id } = req.params;
  const teamId = req.teamId;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing machine ID');
  }
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const machine = database.getMachineWithTeam(id, teamId);

  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${id} not found`);
  }

  // Get credentials
  const credentials = getCredentials(machine.provider_account_id);
  if (!credentials) {
    throw new AppError(
      400,
      'CREDENTIALS_NOT_FOUND',
      'No credentials found for this provider account'
    );
  }

  // Update machine status
  database.updateMachine({
    machine_id: machine.machine_id,
    desired_status: 'terminated',
    actual_status: 'terminating',
    updated_at: new Date().toISOString(),
  });

  // Create deployment for tracking - use authenticated user's ID
  const deployment: Deployment = {
    deployment_id: `deploy_${uuidv4().substring(0, 12)}`,
    team_id: teamId,
    machine_id: machine.machine_id,
    type: 'destroy',
    state: 'applying',
    terraform_workspace: machine.terraform_workspace,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    initiated_by: req.user?.user_id || 'system',
  };

  database.insertDeployment(deployment);

  // Run Terraform destroy in background
  runTerraformDestroy(
    machine.machine_id,
    machine.terraform_workspace,
    deployment.deployment_id
  ).catch((err) => {
    console.error('Terraform destroy failed:', err);
  });

  const response: ApiResponse<{ deployment: Deployment }> = {
    success: true,
    data: { deployment },
  };

  res.json(response);
});

// GET /machines/:id/services - Get machine services
machinesRouter.get('/:id/services', (req: Request, res: Response) => {
  const { id } = req.params;
  const teamId = req.teamId;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing machine ID');
  }
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const machine = database.getMachineWithTeam(id, teamId);

  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${id} not found`);
  }

  // Services require agent connection - return empty if not connected
  const response: ApiResponse<MachineServicesResponse> = {
    success: true,
    data: {
      machine_id: machine.machine_id,
      services: [],
      agent_connected: machine.agent_status === 'connected',
      last_updated: new Date().toISOString(),
    },
  };

  res.json(response);
});

// POST /machines/:id/services/:serviceName/restart - Restart service
machinesRouter.post('/:id/services/:serviceName/restart', (req: Request, _res: Response) => {
  const { id } = req.params;
  const teamId = req.teamId;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing machine ID');
  }
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const machine = database.getMachineWithTeam(id, teamId);

  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${id} not found`);
  }

  if (machine.agent_status !== 'connected') {
    throw new AppError(
      400,
      'AGENT_NOT_CONNECTED',
      'Machine agent is not connected. Service management requires the machine agent to be installed and running.'
    );
  }

  // TODO: Implement actual service restart via machine agent API
  throw new AppError(
    501,
    'NOT_IMPLEMENTED',
    'Service restart requires machine agent which is not yet implemented'
  );
});

// GET /machines/:id/networking - Get machine networking info
machinesRouter.get('/:id/networking', (req: Request, res: Response) => {
  const { id } = req.params;
  const teamId = req.teamId;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing machine ID');
  }
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  const machine = database.getMachineWithTeam(id, teamId);

  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${id} not found`);
  }

  // Get firewall profile rules if one was selected
  let providerRules: FirewallRule[] = [];
  let effectivePorts: number[] = [];

  if (machine.firewall_profile_id) {
    const firewallProfile = database.getFirewallProfile(machine.firewall_profile_id);
    if (firewallProfile?.rules) {
      providerRules = firewallProfile.rules.map((rule, idx) => ({
        rule_id: `pfr${idx + 1}`,
        direction: rule.direction,
        protocol: rule.protocol,
        port_range_start: rule.port_range_start,
        port_range_end: rule.port_range_end,
        source_addresses: rule.source_addresses || ['0.0.0.0/0'],
        ...(rule.description && { description: rule.description }),
        source: 'provider' as const,
      }));

      // Calculate effective inbound ports
      effectivePorts = firewallProfile.rules
        .filter((rule) => rule.direction === 'inbound')
        .flatMap((rule) => {
          if (rule.port_range_start === rule.port_range_end) {
            return [rule.port_range_start];
          }
          // For ranges, just show start and end
          return [rule.port_range_start, rule.port_range_end];
        })
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .sort((a, b) => a - b);
    }
  } else {
    // Default SSH-only if no firewall profile
    providerRules = [
      {
        rule_id: 'pfr1',
        direction: 'inbound',
        protocol: 'tcp',
        port_range_start: 22,
        port_range_end: 22,
        source_addresses: ['0.0.0.0/0'],
        description: 'SSH (default)',
        source: 'provider',
      },
    ];
    effectivePorts = [22];
  }

  const response: ApiResponse<MachineNetworking> = {
    success: true,
    data: {
      machine_id: machine.machine_id,
      provider_firewall_rules: providerRules,
      host_firewall_available: machine.agent_status === 'connected',
      open_ports_available: machine.agent_status === 'connected',
      effective_inbound_ports: effectivePorts,
      last_updated: new Date().toISOString(),
    },
  };

  res.json(response);
});

// POST /machines/sync - Sync all machines with provider state
machinesRouter.post('/sync', async (req: Request, res: Response) => {
  const teamId = req.teamId;
  if (!teamId) {
    throw new AppError(400, 'MISSING_TEAM', 'Team context required');
  }

  // TODO: Update syncMachinesWithProvider to accept teamId filter
  const result = await syncMachinesWithProvider();

  const response: ApiResponse<typeof result> = {
    success: true,
    data: result,
  };

  res.json(response);
});
