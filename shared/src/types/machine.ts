// Machine - Core compute instance model
export type MachineStatus = 
  | 'pending'
  | 'provisioning'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'rebooting'
  | 'terminating'
  | 'terminated'
  | 'error';

export type ProvisioningMethod = 'provider_api' | 'byo_server' | 'unknown';

export type TerraformStateStatus = 'in_sync' | 'drifted' | 'unknown' | 'pending';

export type AgentStatus = 'connected' | 'disconnected' | 'not_installed' | 'unknown';

export interface Machine {
  machine_id: string;
  name: string;
  provider: ProviderType;
  provider_account_id: string;
  region: string;
  zone?: string;
  size: string;
  image: string;
  os_name?: string;
  
  // Status
  desired_status: MachineStatus;
  actual_status: MachineStatus;
  
  // Networking
  public_ip?: string;
  private_ip?: string;
  vpc_id?: string;
  subnet_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Tags and metadata
  tags: Record<string, string>;
  
  // Terraform
  terraform_workspace: string;
  terraform_state_status: TerraformStateStatus;
  
  // Provisioning
  provisioning_method: ProvisioningMethod;
  bootstrap_profile_id?: string;
  
  // Health & Agent
  last_health_check?: string;
  agent_status: AgentStatus;
  
  // Provider-specific IDs
  provider_resource_id?: string;
}

export interface MachineCreateRequest {
  name: string;
  provider_account_id: string;
  region: string;
  zone?: string;
  size: string;
  image: string;
  vpc_id?: string;
  subnet_id?: string;
  firewall_profile_id?: string;
  bootstrap_profile_id?: string;
  ssh_key_ids?: string[]; // SSH key IDs to attach to the machine
  tags?: Record<string, string>;
  run_plan_only?: boolean;
}

export interface MachineListFilter {
  status?: MachineStatus;
  provider?: ProviderType;
  region?: string;
  tag_key?: string;
  tag_value?: string;
  created_after?: string;
  created_before?: string;
  search?: string;
}

export interface MachineListSort {
  field: 'name' | 'status' | 'created_at' | 'provider' | 'region';
  direction: 'asc' | 'desc';
}

export type ProviderType = 'digitalocean' | 'aws' | 'gcp' | 'hetzner' | 'baremetal';



