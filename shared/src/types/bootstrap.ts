// Bootstrap Profile - Defines what gets installed on machine at boot
export type BootstrapMethod = 'cloud_init' | 'ssh_script' | 'ansible';

export interface BootstrapProfile {
  profile_id: string;
  team_id?: string; // Team this profile belongs to (optional for system profiles)
  name: string;
  description?: string;
  method: BootstrapMethod;

  // Templates/scripts (only one should be set based on method)
  cloud_init_template?: string;
  ssh_bootstrap_script?: string;
  ansible_playbook_ref?: string;

  // Services to install and run
  services_to_run: ServiceConfig[];

  // Configuration variables schema
  config_schema?: ConfigVariable[];

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;

  // Tags
  tags?: string[];

  // Whether this is a system profile (read-only)
  is_system_profile: boolean;
}

export interface ServiceConfig {
  service_name: string;
  display_name: string;
  systemd_unit: string;
  install_commands?: string[];
  config_template?: string;
  health_endpoint?: string;
  restart_command?: string;
  ports?: number[];
}

export interface ConfigVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
  description?: string;
  required: boolean;
  default_value?: string | number | boolean;
  validation_regex?: string;
}

export interface BootstrapProfileCreateRequest {
  name: string;
  description?: string;
  method: BootstrapMethod;
  cloud_init_template?: string;
  ssh_bootstrap_script?: string;
  ansible_playbook_ref?: string;
  services_to_run: ServiceConfig[];
  config_schema?: ConfigVariable[];
  tags?: string[];
}
