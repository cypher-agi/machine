// Deployment - Terraform operation tracking
export type DeploymentType =
  | 'create'
  | 'update'
  | 'destroy'
  | 'reboot'
  | 'restart_service'
  | 'refresh';

export type DeploymentState =
  | 'queued'
  | 'planning'
  | 'awaiting_approval'
  | 'applying'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface TerraformPlanSummary {
  resources_to_add: number;
  resources_to_change: number;
  resources_to_destroy: number;
  resource_changes: ResourceChange[];
}

export interface ResourceChange {
  address: string;
  action: 'create' | 'update' | 'delete' | 'replace' | 'read';
  resource_type: string;
  resource_name: string;
}

export interface Deployment {
  deployment_id: string;
  machine_id?: string;
  type: DeploymentType;
  state: DeploymentState;

  // Terraform details
  terraform_workspace: string;
  plan_summary?: TerraformPlanSummary;
  terraform_plan?: string; // Raw terraform plan output

  // Git/versioning
  git_ref?: string;
  module_version?: string;

  // Timestamps
  created_at: string;
  started_at?: string;
  finished_at?: string;
  completed_at?: string; // Alias for finished_at for backwards compatibility

  // Initiator
  initiated_by: string;

  // Error handling
  error_message?: string;

  // Outputs (saved after apply)
  outputs?: Record<string, unknown>;

  // Logs (stored for review)
  logs?: DeploymentLog[];
}

export interface DeploymentLog {
  deployment_id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: 'terraform' | 'system' | 'provider';
}

export interface DeploymentListFilter {
  machine_id?: string;
  type?: DeploymentType;
  state?: DeploymentState;
  created_after?: string;
  created_before?: string;
}
