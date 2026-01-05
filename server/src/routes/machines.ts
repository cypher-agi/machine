import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../services/database';
import { 
  Machine, 
  MachineCreateRequest, 
  MachineListFilter,
  ApiResponse,
  Deployment,
  MachineServicesResponse,
  MachineNetworking,
  FirewallRule
} from '@machine/shared';
import { AppError } from '../middleware/errorHandler';
import { TerraformService, getCredentials } from '../services/terraform';

export const machinesRouter = Router();

// Store for active deployment log listeners
const deploymentLogListeners: Map<string, ((log: any) => void)[]> = new Map();

// GET /machines - List machines with filtering
machinesRouter.get('/', (req: Request, res: Response) => {
  const filters: MachineListFilter = {
    status: req.query.status as any,
    provider: req.query.provider as any,
    region: req.query.region as string,
    tag_key: req.query.tag_key as string,
    tag_value: req.query.tag_value as string,
    search: req.query.search as string
  };

  let filtered = database.getMachines();

  // Apply filters
  if (filters.status) {
    filtered = filtered.filter(m => m.actual_status === filters.status);
  }
  if (filters.provider) {
    filtered = filtered.filter(m => m.provider === filters.provider);
  }
  if (filters.region) {
    filtered = filtered.filter(m => m.region === filters.region);
  }
  if (filters.tag_key && filters.tag_value) {
    filtered = filtered.filter(m => m.tags[filters.tag_key!] === filters.tag_value);
  }
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(m => 
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
        has_prev: page > 1
      },
      timestamp: new Date().toISOString()
    }
  };

  res.json(response);
});

// GET /machines/:id - Get single machine
machinesRouter.get('/:id', (req: Request, res: Response) => {
  const machine = database.getMachine(req.params.id);
  
  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${req.params.id} not found`);
  }

  const response: ApiResponse<Machine> = {
    success: true,
    data: machine
  };

  res.json(response);
});

// POST /machines - Create new machine (with real Terraform!)
machinesRouter.post('/', async (req: Request, res: Response) => {
  const body: MachineCreateRequest = req.body;

  // Validate required fields
  if (!body.name || !body.provider_account_id || !body.region || !body.size || !body.image) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields');
  }

  // Get provider account
  const providerAccount = database.getProviderAccount(body.provider_account_id);
  if (!providerAccount) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Provider account not found');
  }

  // Get credentials
  const credentials = getCredentials(body.provider_account_id);
  if (!credentials) {
    throw new AppError(400, 'CREDENTIALS_NOT_FOUND', 'No credentials found for this provider account. Please add your API token in Provider settings.');
  }

  // Create new machine record
  const machineId = `mach_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
  const workspaceName = `machine-${machineId}`;
  
  const newMachine: Machine = {
    machine_id: machineId,
    name: body.name,
    provider: providerAccount.provider_type,
    provider_account_id: body.provider_account_id,
    region: body.region,
    zone: body.zone,
    size: body.size,
    image: body.image,
    desired_status: 'running',
    actual_status: 'provisioning',
    vpc_id: body.vpc_id,
    subnet_id: body.subnet_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: body.tags || {},
    terraform_workspace: workspaceName,
    terraform_state_status: 'pending',
    provisioning_method: 'provider_api',
    bootstrap_profile_id: body.bootstrap_profile_id,
    firewall_profile_id: body.firewall_profile_id,
    agent_status: 'not_installed'
  };

  // Create deployment record
  const deploymentId = `deploy_${uuidv4().substring(0, 12)}`;
  const deployment: Deployment = {
    deployment_id: deploymentId,
    machine_id: machineId,
    type: 'create',
    state: 'planning',
    terraform_workspace: workspaceName,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    initiated_by: 'user_current'
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
  runTerraformCreate(newMachine, deployment, credentials, providerAccount.provider_type, cloudInitTemplate, firewallProfile).catch(err => {
    console.error('Terraform execution failed:', err);
  });

  const response: ApiResponse<{ machine: Machine; deployment: Deployment }> = {
    success: true,
    data: { machine: newMachine, deployment }
  };

  res.status(201).json(response);
});

// Background Terraform execution
async function runTerraformCreate(
  machine: Machine, 
  deployment: Deployment, 
  credentials: Record<string, string>,
  providerType: string,
  cloudInitTemplate?: string,
  firewallProfile?: any
) {
  const logListeners = deploymentLogListeners.get(deployment.deployment_id) || [];
  
  const onLog = (log: any) => {
    logListeners.forEach(listener => listener({
      ...log,
      timestamp: new Date().toISOString()
    }));
  };

  const tf = new TerraformService(machine.terraform_workspace, onLog);

  try {
    // Determine module based on provider
    let modulePath: string;
    let vars: Record<string, any>;

    if (providerType === 'digitalocean') {
      modulePath = 'digitalocean';
      
      // Convert firewall profile rules to Terraform format
      let firewallEnabled = false;
      let firewallInboundRules: { protocol: string; port_range: string; source_addresses: string[] }[] = [];
      
      if (firewallProfile && firewallProfile.rules && firewallProfile.rules.length > 0) {
        firewallEnabled = true;
        firewallInboundRules = firewallProfile.rules
          .filter((rule: any) => rule.direction === 'inbound')
          .map((rule: any) => ({
            protocol: rule.protocol,
            port_range: rule.port_range_start === rule.port_range_end 
              ? String(rule.port_range_start)
              : `${rule.port_range_start}-${rule.port_range_end}`,
            source_addresses: rule.source_addresses || ['0.0.0.0/0', '::/0']
          }));
        
        onLog({ level: 'info', message: `Firewall profile "${firewallProfile.name}" will be applied with ${firewallInboundRules.length} inbound rules`, source: 'system' });
      } else {
        // Default: just SSH if no firewall profile
        firewallEnabled = true;
        firewallInboundRules = [
          { protocol: 'tcp', port_range: '22', source_addresses: ['0.0.0.0/0', '::/0'] }
        ];
        onLog({ level: 'info', message: 'No firewall profile selected, applying default SSH-only rules', source: 'system' });
      }
      
      vars = {
        do_token: credentials.api_token,
        name: machine.name,
        region: machine.region,
        size: machine.size,
        image: machine.image,
        tags: Object.entries(machine.tags).map(([k, v]) => `${k}:${v}`),
        user_data: cloudInitTemplate || '',
        firewall_enabled: firewallEnabled,
        firewall_inbound_rules: firewallInboundRules
      };
      
      if (cloudInitTemplate) {
        onLog({ level: 'info', message: 'Bootstrap profile cloud-init will be applied to the machine', source: 'system' });
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
        { address: 'digitalocean_droplet.main', action: 'create', resource_type: 'digitalocean_droplet', resource_name: 'main' },
        { address: 'digitalocean_firewall.main', action: 'create', resource_type: 'digitalocean_firewall', resource_name: 'main' }
      ]
    };

    // Apply
    deployment.state = 'applying';
    onLog({ level: 'info', message: 'Applying changes...', source: 'system' });
    const applyResult = await tf.apply(planResult.planFile);

    if (applyResult.success && applyResult.outputs) {
      // Update machine with real values
      database.updateMachine({
        machine_id: machine.machine_id,
        public_ip: applyResult.outputs.public_ip,
        private_ip: applyResult.outputs.private_ip,
        provider_resource_id: String(applyResult.outputs.droplet_id),
        actual_status: 'running',
        terraform_state_status: 'in_sync',
        updated_at: new Date().toISOString()
      });

      database.updateDeployment({
        deployment_id: deployment.deployment_id,
        state: 'succeeded',
        finished_at: new Date().toISOString(),
        outputs: applyResult.outputs
      });

      onLog({ level: 'info', message: `✓ Machine created successfully! IP: ${applyResult.outputs.public_ip}`, source: 'system' });
    } else {
      throw new Error(applyResult.error || 'Apply failed');
    }

  } catch (error: any) {
    console.error('Terraform error:', error);
    database.updateMachine({
      machine_id: machine.machine_id,
      actual_status: 'error',
      terraform_state_status: 'unknown',
      updated_at: new Date().toISOString()
    });
    
    database.updateDeployment({
      deployment_id: deployment.deployment_id,
      state: 'failed',
      finished_at: new Date().toISOString(),
      error_message: error.message
    });

    onLog({ level: 'error', message: `Deployment failed: ${error.message}`, source: 'system' });
  }
}

// POST /machines/:id/reboot - Reboot machine via DigitalOcean API
machinesRouter.post('/:id/reboot', async (req: Request, res: Response) => {
  const machine = database.getMachine(req.params.id);
  
  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${req.params.id} not found`);
  }

  if (machine.actual_status !== 'running') {
    throw new AppError(400, 'INVALID_STATE', 'Machine must be running to reboot');
  }

  if (!machine.provider_resource_id) {
    throw new AppError(400, 'NO_RESOURCE_ID', 'Machine has no provider resource ID');
  }

  const credentials = getCredentials(machine.provider_account_id);
  if (!credentials) {
    throw new AppError(400, 'CREDENTIALS_NOT_FOUND', 'No credentials found for this provider account');
  }

  // Update machine status
  database.updateMachine({
    machine_id: machine.machine_id,
    actual_status: 'rebooting',
    updated_at: new Date().toISOString()
  });

  // Create deployment for tracking
  const deployment: Deployment = {
    deployment_id: `deploy_${uuidv4().substring(0, 12)}`,
    machine_id: machine.machine_id,
    type: 'reboot',
    state: 'applying',
    terraform_workspace: machine.terraform_workspace,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    initiated_by: 'user_current'
  };

  database.insertDeployment(deployment);

  // Call DigitalOcean API to reboot
  runReboot(machine.machine_id, machine.provider_resource_id, deployment.deployment_id, credentials).catch(err => {
    console.error('Reboot failed:', err);
  });

  const response: ApiResponse<{ deployment: Deployment }> = {
    success: true,
    data: { deployment }
  };

  res.json(response);
});

async function runReboot(machineId: string, resourceId: string, deploymentId: string, credentials: Record<string, string>) {
  try {
    const response = await fetch(
      `https://api.digitalocean.com/v2/droplets/${resourceId}/actions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.api_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'reboot' })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Reboot API call failed');
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(
        `https://api.digitalocean.com/v2/droplets/${resourceId}`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.api_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (statusResponse.ok) {
        const data = await statusResponse.json();
        if (data.droplet.status === 'active') {
          database.updateMachine({
            machine_id: machineId,
            actual_status: 'running',
            updated_at: new Date().toISOString()
          });
          database.updateDeployment({
            deployment_id: deploymentId,
            state: 'succeeded',
            finished_at: new Date().toISOString()
          });
          return;
        }
      }
      attempts++;
    }

    throw new Error('Reboot timed out');
  } catch (error: any) {
    database.updateMachine({
      machine_id: machineId,
      actual_status: 'error',
      updated_at: new Date().toISOString()
    });
    database.updateDeployment({
      deployment_id: deploymentId,
      state: 'failed',
      finished_at: new Date().toISOString(),
      error_message: error.message
    });
  }
}

// POST /machines/:id/destroy - Destroy machine (with real Terraform!)
machinesRouter.post('/:id/destroy', async (req: Request, res: Response) => {
  const machine = database.getMachine(req.params.id);
  
  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${req.params.id} not found`);
  }

  // Get credentials
  const credentials = getCredentials(machine.provider_account_id);
  if (!credentials) {
    throw new AppError(400, 'CREDENTIALS_NOT_FOUND', 'No credentials found for this provider account');
  }
  
  // Update machine status
  database.updateMachine({
    machine_id: machine.machine_id,
    desired_status: 'terminated',
    actual_status: 'terminating',
    updated_at: new Date().toISOString()
  });

  // Create deployment for tracking
  const deployment: Deployment = {
    deployment_id: `deploy_${uuidv4().substring(0, 12)}`,
    machine_id: machine.machine_id,
    type: 'destroy',
    state: 'applying',
    terraform_workspace: machine.terraform_workspace,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    initiated_by: 'user_current'
  };

  database.insertDeployment(deployment);

  // Run Terraform destroy in background
  runTerraformDestroy(machine.machine_id, machine.terraform_workspace, deployment.deployment_id).catch(err => {
    console.error('Terraform destroy failed:', err);
  });

  const response: ApiResponse<{ deployment: Deployment }> = {
    success: true,
    data: { deployment }
  };

  res.json(response);
});

async function runTerraformDestroy(machineId: string, workspace: string | undefined, deploymentId: string) {
  const tf = new TerraformService(workspace || machineId);

  try {
    const result = await tf.destroy();

    if (result.success) {
      database.updateMachine({
        machine_id: machineId,
        actual_status: 'terminated',
        terraform_state_status: 'in_sync',
        updated_at: new Date().toISOString()
      });
      
      database.updateDeployment({
        deployment_id: deploymentId,
        state: 'succeeded',
        finished_at: new Date().toISOString()
      });

      // Clean up workspace
      tf.cleanup();
    } else {
      throw new Error(result.error || 'Destroy failed');
    }
  } catch (error: any) {
    database.updateMachine({
      machine_id: machineId,
      actual_status: 'error',
      updated_at: new Date().toISOString()
    });
    
    database.updateDeployment({
      deployment_id: deploymentId,
      state: 'failed',
      finished_at: new Date().toISOString(),
      error_message: error.message
    });
  }
}

// GET /machines/:id/services - Get machine services
machinesRouter.get('/:id/services', (req: Request, res: Response) => {
  const machine = database.getMachine(req.params.id);
  
  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${req.params.id} not found`);
  }

  // Services require agent connection - return empty if not connected
  const services: any[] = [];

  const response: ApiResponse<MachineServicesResponse> = {
    success: true,
    data: {
      machine_id: machine.machine_id,
      services,
      agent_connected: machine.agent_status === 'connected',
      last_updated: new Date().toISOString()
    }
  };

  res.json(response);
});

// POST /machines/:id/services/:serviceName/restart - Restart service
machinesRouter.post('/:id/services/:serviceName/restart', (req: Request, res: Response) => {
  const machine = database.getMachine(req.params.id);
  
  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${req.params.id} not found`);
  }

  if (machine.agent_status !== 'connected') {
    throw new AppError(400, 'AGENT_NOT_CONNECTED', 'Machine agent is not connected. Service management requires the machine agent to be installed and running.');
  }

  // TODO: Implement actual service restart via machine agent API
  throw new AppError(501, 'NOT_IMPLEMENTED', 'Service restart requires machine agent which is not yet implemented');
});

// GET /machines/:id/networking - Get machine networking info
machinesRouter.get('/:id/networking', (req: Request, res: Response) => {
  const machine = database.getMachine(req.params.id);
  
  if (!machine) {
    throw new AppError(404, 'MACHINE_NOT_FOUND', `Machine ${req.params.id} not found`);
  }

  // Get firewall profile rules if one was selected
  let providerRules: FirewallRule[] = [];
  let effectivePorts: number[] = [];
  
  if (machine.firewall_profile_id) {
    const firewallProfile = database.getFirewallProfile(machine.firewall_profile_id);
    if (firewallProfile && firewallProfile.rules) {
      providerRules = firewallProfile.rules.map((rule: any, idx: number) => ({
        rule_id: `pfr${idx + 1}`,
        direction: rule.direction,
        protocol: rule.protocol,
        port_range_start: rule.port_range_start,
        port_range_end: rule.port_range_end,
        source_addresses: rule.source_addresses || ['0.0.0.0/0'],
        description: rule.description,
        source: 'provider'
      }));
      
      // Calculate effective inbound ports
      effectivePorts = firewallProfile.rules
        .filter((rule: any) => rule.direction === 'inbound')
        .flatMap((rule: any) => {
          if (rule.port_range_start === rule.port_range_end) {
            return [rule.port_range_start];
          }
          // For ranges, just show start and end
          return [rule.port_range_start, rule.port_range_end];
        })
        .filter((v: number, i: number, a: number[]) => a.indexOf(v) === i) // unique
        .sort((a: number, b: number) => a - b);
    }
  } else {
    // Default SSH-only if no firewall profile
    providerRules = [
      { rule_id: 'pfr1', direction: 'inbound', protocol: 'tcp', port_range_start: 22, port_range_end: 22, source_addresses: ['0.0.0.0/0'], description: 'SSH (default)', source: 'provider' }
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
      last_updated: new Date().toISOString()
    }
  };

  res.json(response);
});

// Export for deployment log streaming
export function addDeploymentLogListener(deploymentId: string, listener: (log: any) => void) {
  const listeners = deploymentLogListeners.get(deploymentId) || [];
  listeners.push(listener);
  deploymentLogListeners.set(deploymentId, listeners);
}

export function removeDeploymentLogListener(deploymentId: string, listener: (log: any) => void) {
  const listeners = deploymentLogListeners.get(deploymentId) || [];
  const index = listeners.indexOf(listener);
  if (index > -1) {
    listeners.splice(index, 1);
  }
}
