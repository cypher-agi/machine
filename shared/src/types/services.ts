// Services - Runtime service status tracking
export type ServiceState = 
  | 'running'
  | 'stopped'
  | 'failed'
  | 'restarting'
  | 'unknown';

export type ServiceHealth = 'healthy' | 'unhealthy' | 'unknown';

export interface MachineService {
  service_name: string;
  display_name: string;
  systemd_unit: string;
  state: ServiceState;
  health: ServiceHealth;
  
  // Metadata
  version?: string;
  uptime_seconds?: number;
  started_at?: string;
  
  // Resource usage (if available)
  cpu_percent?: number;
  memory_mb?: number;
  
  // Error info
  last_error?: string;
  last_error_at?: string;
  exit_code?: number;
  
  // Ports
  ports?: number[];
  
  // Health endpoint
  health_endpoint?: string;
  last_health_check?: string;
}

export interface MachineServicesResponse {
  machine_id: string;
  services: MachineService[];
  agent_connected: boolean;
  last_updated: string;
}

export interface ServiceRestartRequest {
  service_name: string;
  force?: boolean;
}

export interface ServiceRestartResponse {
  service_name: string;
  success: boolean;
  message?: string;
  deployment_id?: string;
}




