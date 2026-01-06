
import type {
  ApiResponse,
  Machine,
  MachineCreateRequest,
  MachineListFilter,
  MachineServicesResponse,
  MachineNetworking,
  Deployment,
  DeploymentListFilter,
  ProviderAccount,
  ProviderAccountCreateRequest,
  ProviderOptions,
  BootstrapProfile,
  BootstrapProfileCreateRequest,
  FirewallProfile,
  AuditEvent,
  AuditEventListFilter,
  ProviderType,
  SSHKey,
  SSHKeyCreateRequest,
  SSHKeyImportRequest,
  SSHKeyGenerateResponse,
} from '@machina/shared';

const API_BASE = '/api';

/**
 * Build query string from params object, filtering out empty values
 */
function buildQueryString<T extends object>(params?: T): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'An error occurred');
  }

  return data.data as T;
}

// ============ Machines API ============

export interface MachineListParams extends MachineListFilter {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export async function getMachines(params?: MachineListParams): Promise<Machine[]> {
  return fetchApi<Machine[]>(`/machines${buildQueryString(params)}`);
}

export async function getMachine(id: string): Promise<Machine> {
  return fetchApi<Machine>(`/machines/${id}`);
}

export async function createMachine(
  data: MachineCreateRequest
): Promise<{ machine: Machine; deployment: Deployment }> {
  return fetchApi<{ machine: Machine; deployment: Deployment }>('/machines', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function rebootMachine(id: string): Promise<{ deployment: Deployment }> {
  return fetchApi<{ deployment: Deployment }>(`/machines/${id}/reboot`, {
    method: 'POST',
  });
}

export async function destroyMachine(id: string): Promise<{ deployment: Deployment }> {
  return fetchApi<{ deployment: Deployment }>(`/machines/${id}/destroy`, {
    method: 'POST',
  });
}

export interface AgentMetrics {
  machine_id: string;
  agent_version: string;
  hostname: string;
  uptime_seconds: number;
  load_average: [number, number, number];
  memory_total_mb: number;
  memory_used_mb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  last_heartbeat: string;
}

export async function getAgentMetrics(machineId: string): Promise<AgentMetrics | null> {
  return fetchApi<AgentMetrics | null>(`/agent/metrics/${machineId}`);
}

export async function getMachineServices(id: string): Promise<MachineServicesResponse> {
  return fetchApi<MachineServicesResponse>(`/machines/${id}/services`);
}

export async function restartMachineService(
  machineId: string,
  serviceName: string
): Promise<{ service_name: string; deployment: Deployment }> {
  return fetchApi<{ service_name: string; deployment: Deployment }>(
    `/machines/${machineId}/services/${serviceName}/restart`,
    { method: 'POST' }
  );
}

export async function getMachineNetworking(id: string): Promise<MachineNetworking> {
  return fetchApi<MachineNetworking>(`/machines/${id}/networking`);
}

export interface SyncResult {
  machine_id: string;
  name: string;
  previous_status: string;
  new_status: string;
  action: string;
}

export async function syncMachines(): Promise<{ synced: number; results: SyncResult[] }> {
  return fetchApi<{ synced: number; results: SyncResult[] }>('/machines/sync', {
    method: 'POST',
  });
}

// ============ Providers API ============

export async function getProviders(): Promise<
  { type: ProviderType; name: string; supported: boolean }[]
> {
  return fetchApi<{ type: ProviderType; name: string; supported: boolean }[]>('/providers');
}

export async function getProviderOptions(type: ProviderType): Promise<ProviderOptions> {
  return fetchApi<ProviderOptions>(`/providers/${type}/options`);
}

export async function getProviderAccounts(): Promise<ProviderAccount[]> {
  return fetchApi<ProviderAccount[]>('/providers/accounts');
}

export async function getProviderAccount(id: string): Promise<ProviderAccount> {
  return fetchApi<ProviderAccount>(`/providers/accounts/${id}`);
}

export async function createProviderAccount(
  type: ProviderType,
  data: ProviderAccountCreateRequest
): Promise<ProviderAccount> {
  return fetchApi<ProviderAccount>(`/providers/${type}/accounts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyProviderAccount(id: string): Promise<ProviderAccount> {
  return fetchApi<ProviderAccount>(`/providers/accounts/${id}/verify`, {
    method: 'POST',
  });
}

export async function updateProviderAccount(
  id: string, 
  data: { label?: string; credentials?: Record<string, string> }
): Promise<ProviderAccount> {
  return fetchApi<ProviderAccount>(`/providers/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProviderAccount(id: string): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/providers/accounts/${id}`, {
    method: 'DELETE',
  });
}

// ============ Deployments API ============

export interface DeploymentListParams extends DeploymentListFilter {
  page?: number;
  per_page?: number;
}

export async function getDeployments(params?: DeploymentListParams): Promise<Deployment[]> {
  return fetchApi<Deployment[]>(`/deployments${buildQueryString(params)}`);
}

export async function getDeployment(id: string): Promise<Deployment> {
  return fetchApi<Deployment>(`/deployments/${id}`);
}

export async function cancelDeployment(id: string): Promise<Deployment> {
  return fetchApi<Deployment>(`/deployments/${id}/cancel`, {
    method: 'POST',
  });
}

export async function approveDeployment(id: string): Promise<Deployment> {
  return fetchApi<Deployment>(`/deployments/${id}/approve`, {
    method: 'POST',
  });
}

// Fetch deployment logs (non-streaming, for completed deployments)
export async function getDeploymentLogs(deploymentId: string): Promise<{ timestamp: string; level: string; message: string; source: string }[]> {
  return fetchApi<{ timestamp: string; level: string; message: string; source: string }[]>(`/deployments/${deploymentId}/logs`);
}

// SSE for deployment logs
export function streamDeploymentLogs(
  deploymentId: string,
  onLog: (log: { timestamp: string; level: string; message: string; source: string }) => void,
  onComplete: (state: string) => void,
  onError: (error: Error) => void
): () => void {
  // First fetch existing logs via regular API
  getDeploymentLogs(deploymentId)
    .then(logs => {
      logs.forEach(log => onLog(log));
    })
    .catch(err => {
      console.warn('Failed to fetch existing logs:', err);
    });

  const eventSource = new EventSource(
    `${API_BASE}/deployments/${deploymentId}/logs?stream=true`
  );

  eventSource.addEventListener('log', (event) => {
    try {
      const log = JSON.parse(event.data);
      onLog(log);
    } catch (e) {
      console.error('Failed to parse log event', e);
    }
  });

  eventSource.addEventListener('complete', (event) => {
    try {
      const data = JSON.parse(event.data);
      onComplete(data.state);
    } catch (e) {
      console.error('Failed to parse complete event', e);
    }
    eventSource.close();
  });

  eventSource.onerror = () => {
    onError(new Error('Connection lost'));
    eventSource.close();
  };

  return () => eventSource.close();
}

// ============ Bootstrap API ============

export async function getBootstrapProfiles(): Promise<BootstrapProfile[]> {
  return fetchApi<BootstrapProfile[]>('/bootstrap/profiles');
}

export async function getBootstrapProfile(id: string): Promise<BootstrapProfile> {
  return fetchApi<BootstrapProfile>(`/bootstrap/profiles/${id}`);
}

export async function createBootstrapProfile(
  data: BootstrapProfileCreateRequest
): Promise<BootstrapProfile> {
  return fetchApi<BootstrapProfile>('/bootstrap/profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBootstrapProfile(
  id: string,
  data: Partial<BootstrapProfileCreateRequest>
): Promise<BootstrapProfile> {
  return fetchApi<BootstrapProfile>(`/bootstrap/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteBootstrapProfile(id: string): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/bootstrap/profiles/${id}`, {
    method: 'DELETE',
  });
}

export async function getFirewallProfiles(): Promise<FirewallProfile[]> {
  return fetchApi<FirewallProfile[]>('/bootstrap/firewall-profiles');
}

// ============ Audit API ============

export interface AuditListParams extends AuditEventListFilter {
  page?: number;
  per_page?: number;
}

export async function getAuditEvents(params?: AuditListParams): Promise<AuditEvent[]> {
  return fetchApi<AuditEvent[]>(`/audit/events${buildQueryString(params)}`);
}

// ============ SSH Keys API ============

export async function getSSHKeys(): Promise<SSHKey[]> {
  return fetchApi<SSHKey[]>('/ssh/keys');
}

export async function getSSHKey(id: string): Promise<SSHKey> {
  return fetchApi<SSHKey>(`/ssh/keys/${id}`);
}

export async function generateSSHKey(data: SSHKeyCreateRequest): Promise<SSHKeyGenerateResponse> {
  return fetchApi<SSHKeyGenerateResponse>('/ssh/keys/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function importSSHKey(data: SSHKeyImportRequest): Promise<SSHKey> {
  return fetchApi<SSHKey>('/ssh/keys/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSSHKeyPrivate(id: string): Promise<{ private_key: string }> {
  return fetchApi<{ private_key: string }>(`/ssh/keys/${id}/private`);
}

export async function syncSSHKeyToProvider(keyId: string, providerAccountId: string): Promise<SSHKey> {
  return fetchApi<SSHKey>(`/ssh/keys/${keyId}/sync/${providerAccountId}`, {
    method: 'POST',
  });
}

export async function unsyncSSHKeyFromProvider(keyId: string, providerType: string): Promise<SSHKey> {
  return fetchApi<SSHKey>(`/ssh/keys/${keyId}/sync/${providerType}`, {
    method: 'DELETE',
  });
}

export async function updateSSHKey(id: string, data: { name: string }): Promise<SSHKey> {
  return fetchApi<SSHKey>(`/ssh/keys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSSHKey(id: string): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/ssh/keys/${id}`, {
    method: 'DELETE',
  });
}



