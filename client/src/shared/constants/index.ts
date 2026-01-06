// Import all types and icons at the top
import type { 
  SSHKeyType, 
  BootstrapMethod, 
  MachineStatus, 
  CredentialStatus, 
  DeploymentState, 
  DeploymentType 
} from '@machina/shared';
import { 
  Cloud, 
  Terminal, 
  Play, 
  Check, 
  X, 
  AlertCircle, 
  Clock, 
  Loader2, 
  StopCircle 
} from 'lucide-react';

// Provider constants
export const PROVIDER_LABELS: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
  baremetal: 'BM',
};

export const PROVIDER_FULL_LABELS: Record<string, string> = {
  digitalocean: 'DigitalOcean',
  aws: 'Amazon Web Services',
  gcp: 'Google Cloud Platform',
  hetzner: 'Hetzner Cloud',
  baremetal: 'Bare Metal',
};

// SSH Key type labels
export const KEY_TYPE_LABELS: Record<SSHKeyType, string> = {
  ed25519: 'ED25519',
  rsa: 'RSA',
  ecdsa: 'ECDSA',
};

// Bootstrap method configuration
export const BOOTSTRAP_METHOD_ICONS: Record<BootstrapMethod, typeof Cloud> = {
  cloud_init: Cloud,
  ssh_script: Terminal,
  ansible: Play,
};

export const BOOTSTRAP_METHOD_LABELS: Record<BootstrapMethod, string> = {
  cloud_init: 'Cloud-Init',
  ssh_script: 'SSH Script',
  ansible: 'Ansible',
};

// Machine status configuration
export const MACHINE_STATUS_PRIORITY: Record<MachineStatus, number> = {
  running: 0,
  provisioning: 1,
  rebooting: 2,
  pending: 3,
  stopping: 4,
  stopped: 5,
  terminating: 6,
  terminated: 7,
  error: 8,
};

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  running: 'Running',
  provisioning: 'Provisioning',
  rebooting: 'Rebooting',
  pending: 'Pending',
  stopping: 'Stopping',
  stopped: 'Stopped',
  terminating: 'Terminating',
  terminated: 'Terminated',
  error: 'Error',
};

export const MACHINE_STATUS_CONFIG: Record<MachineStatus, { label: string; variant: 'running' | 'stopped' | 'provisioning' | 'pending' | 'error'; pulse?: boolean }> = {
  running: { label: 'Running', variant: 'running', pulse: true },
  stopped: { label: 'Stopped', variant: 'stopped' },
  provisioning: { label: 'Provisioning', variant: 'provisioning', pulse: true },
  pending: { label: 'Pending', variant: 'pending', pulse: true },
  stopping: { label: 'Stopping', variant: 'pending', pulse: true },
  rebooting: { label: 'Rebooting', variant: 'provisioning', pulse: true },
  terminating: { label: 'Terminating', variant: 'error', pulse: true },
  terminated: { label: 'Terminated', variant: 'stopped' },
  error: { label: 'Error', variant: 'error' },
};

// Credential status configuration
export const CREDENTIAL_STATUS_CONFIG: Record<CredentialStatus, { icon: typeof Check; variant: 'valid' | 'invalid' | 'warning' | 'muted'; label: string }> = {
  valid: { icon: Check, variant: 'valid', label: 'Valid' },
  invalid: { icon: X, variant: 'invalid', label: 'Invalid' },
  expired: { icon: AlertCircle, variant: 'warning', label: 'Expired' },
  unchecked: { icon: AlertCircle, variant: 'muted', label: 'Unchecked' },
};

// Variant mapping for sidekick badge (different variant types)
export const CREDENTIAL_STATUS_BADGE_CONFIG: Record<CredentialStatus, { label: string; variant: 'running' | 'stopped' | 'error' | 'pending' }> = {
  valid: { label: 'Valid', variant: 'running' },
  invalid: { label: 'Invalid', variant: 'error' },
  expired: { label: 'Expired', variant: 'stopped' },
  unchecked: { label: 'Unchecked', variant: 'pending' },
};

// Deployment state configuration
export const DEPLOYMENT_STATE_CONFIG: Record<DeploymentState, { icon: typeof Check; variant: 'valid' | 'invalid' | 'warning' | 'muted' | 'pending' | 'provisioning'; label: string }> = {
  queued: { icon: Clock, variant: 'pending', label: 'Queued' },
  planning: { icon: Loader2, variant: 'provisioning', label: 'Planning' },
  awaiting_approval: { icon: AlertCircle, variant: 'warning', label: 'Awaiting' },
  applying: { icon: Loader2, variant: 'provisioning', label: 'Applying' },
  succeeded: { icon: Check, variant: 'valid', label: 'Succeeded' },
  failed: { icon: X, variant: 'invalid', label: 'Failed' },
  cancelled: { icon: StopCircle, variant: 'muted', label: 'Cancelled' },
};

// Variant mapping for sidekick badge (different variant types)
export const DEPLOYMENT_STATE_BADGE_CONFIG: Record<DeploymentState, { icon: typeof Check; variant: 'running' | 'stopped' | 'provisioning' | 'pending' | 'error'; label: string }> = {
  queued: { icon: Clock, variant: 'pending', label: 'Queued' },
  planning: { icon: Loader2, variant: 'provisioning', label: 'Planning' },
  awaiting_approval: { icon: AlertCircle, variant: 'pending', label: 'Awaiting Approval' },
  applying: { icon: Loader2, variant: 'provisioning', label: 'Applying' },
  succeeded: { icon: Check, variant: 'running', label: 'Succeeded' },
  failed: { icon: X, variant: 'error', label: 'Failed' },
  cancelled: { icon: StopCircle, variant: 'stopped', label: 'Cancelled' },
};

// Deployment type labels
export const DEPLOYMENT_TYPE_LABELS: Record<DeploymentType, string> = {
  create: 'Create',
  update: 'Update',
  destroy: 'Destroy',
  reboot: 'Reboot',
  restart_service: 'Restart',
  refresh: 'Refresh',
};

export const DEPLOYMENT_TYPE_FULL_LABELS: Record<DeploymentType, string> = {
  create: 'Create Machine',
  update: 'Update Machine',
  destroy: 'Destroy Machine',
  reboot: 'Reboot Machine',
  restart_service: 'Restart Service',
  refresh: 'Refresh State',
};
