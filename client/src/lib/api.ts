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
  Team,
  TeamMember,
  TeamInvite,
  TeamWithMembership,
  TeamDetailResponse,
  TeamMemberWithUser,
  TeamMemberDetail,
  TeamMemberListFilter,
  TeamRole,
  CreateTeamRequest,
  UpdateTeamRequest,
  HandleAvailabilityResponse,
  IntegrationListItem,
  IntegrationType,
  IntegrationStatusResponse,
  IntegrationSetupInfo,
  ConnectStartResponse,
  SyncResponse,
  GitHubRepository,
  GitHubMember,
  GitHubRepoFilter,
  GitHubMemberFilter,
  // Repository types
  Repository,
  RepositoryWithStats,
  CommitWithRepo,
  PullRequestWithDetails,
  Contributor,
  RepositoryListFilter,
  CommitListFilter,
  PullRequestListFilter,
  ContributorListFilter,
  AddRepositoryFromGitHubRequest,
  RepositorySyncResponse,
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

// Store reference for accessing current team ID
// This is set by the auth store to avoid circular imports
let getTeamIdFn: (() => string | null) | null = null;

export function setTeamIdGetter(fn: () => string | null): void {
  getTeamIdFn = fn;
}

// Helper to get current team ID - prefers store, falls back to localStorage
function getCurrentTeamId(): string | null {
  // First try the store getter (most up-to-date)
  if (getTeamIdFn) {
    return getTeamIdFn();
  }

  // Fallback to localStorage
  const authData = localStorage.getItem('auth-storage');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.state?.currentTeamId || null;
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get token from localStorage (matches authStore persist key)
  const authData = localStorage.getItem('auth-storage');
  let sessionToken: string | null = null;

  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      sessionToken = parsed.state?.sessionToken || null;
    } catch {
      // Ignore parse errors
    }
  }

  // Get current team ID for team context
  const currentTeamId = getCurrentTeamId();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
      ...(currentTeamId && { 'X-Team-Id': currentTeamId }),
      ...options?.headers,
    },
  });

  // Handle 401 - session expired or invalid
  if (response.status === 401) {
    // Clear auth storage
    localStorage.removeItem('auth-storage');
    // Redirect to login
    window.location.href = '/login';
    throw new Error('Session expired');
  }

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
export async function getDeploymentLogs(
  deploymentId: string
): Promise<{ timestamp: string; level: string; message: string; source: string }[]> {
  return fetchApi<{ timestamp: string; level: string; message: string; source: string }[]>(
    `/deployments/${deploymentId}/logs`
  );
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
    .then((logs) => {
      logs.forEach((log) => onLog(log));
    })
    .catch((err) => {
      console.warn('Failed to fetch existing logs:', err);
    });

  const eventSource = new EventSource(`${API_BASE}/deployments/${deploymentId}/logs?stream=true`);

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

export async function syncSSHKeyToProvider(
  keyId: string,
  providerAccountId: string
): Promise<SSHKey> {
  return fetchApi<SSHKey>(`/ssh/keys/${keyId}/sync/${providerAccountId}`, {
    method: 'POST',
  });
}

export async function unsyncSSHKeyFromProvider(
  keyId: string,
  providerType: string
): Promise<SSHKey> {
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

// ============ Teams API ============

export async function getTeams(): Promise<TeamWithMembership[]> {
  return fetchApi<TeamWithMembership[]>('/teams');
}

export async function getTeam(id: string): Promise<TeamDetailResponse> {
  return fetchApi<TeamDetailResponse>(`/teams/${id}`);
}

export async function checkHandleAvailability(
  handle: string,
  excludeTeamId?: string
): Promise<HandleAvailabilityResponse> {
  const params = excludeTeamId ? `?exclude=${excludeTeamId}` : '';
  return fetchApi<HandleAvailabilityResponse>(
    `/teams/check-handle/${encodeURIComponent(handle)}${params}`
  );
}

export async function createTeam(data: CreateTeamRequest): Promise<Team> {
  return fetchApi<Team>('/teams', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTeam(id: string, data: UpdateTeamRequest): Promise<Team> {
  return fetchApi<Team>(`/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadTeamAvatar(teamId: string, file: File): Promise<Team> {
  const authData = localStorage.getItem('auth-storage');
  let sessionToken: string | null = null;

  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      sessionToken = parsed.state?.sessionToken || null;
    } catch {
      // Ignore parse errors
    }
  }

  const currentTeamId = getCurrentTeamId();

  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${API_BASE}/teams/${teamId}/avatar`, {
    method: 'POST',
    headers: {
      ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
      ...(currentTeamId && { 'X-Team-Id': currentTeamId }),
    },
    body: formData,
  });

  const data: ApiResponse<Team> = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to upload avatar');
  }

  return data.data as Team;
}

export async function deleteTeamAvatar(teamId: string): Promise<Team> {
  return fetchApi<Team>(`/teams/${teamId}/avatar`, {
    method: 'DELETE',
  });
}

export async function deleteTeam(id: string): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/teams/${id}`, {
    method: 'DELETE',
  });
}

export async function createTeamInvite(teamId: string): Promise<TeamInvite> {
  return fetchApi<TeamInvite>(`/teams/${teamId}/invites`, {
    method: 'POST',
  });
}

export async function revokeTeamInvite(
  teamId: string,
  inviteId: string
): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/teams/${teamId}/invites/${inviteId}`, {
    method: 'DELETE',
  });
}

export async function joinTeam(inviteCode: string): Promise<{ member: TeamMember; team: Team }> {
  return fetchApi<{ member: TeamMember; team: Team }>('/teams/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode }),
  });
}

export async function removeTeamMember(
  teamId: string,
  memberId: string
): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function updateTeamMemberRole(
  teamId: string,
  memberId: string,
  role: TeamRole
): Promise<TeamMember> {
  return fetchApi<TeamMember>(`/teams/${teamId}/members/${memberId}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

// ============ Integrations API ============

export async function getIntegrations(): Promise<IntegrationListItem[]> {
  return fetchApi<IntegrationListItem[]>('/integrations');
}

export async function getIntegrationStatus(
  type: IntegrationType
): Promise<IntegrationStatusResponse> {
  return fetchApi<IntegrationStatusResponse>(`/integrations/${type}/status`);
}

export async function getIntegrationSetupInfo(
  type: IntegrationType
): Promise<IntegrationSetupInfo> {
  return fetchApi<IntegrationSetupInfo>(`/integrations/${type}/setup`);
}

export async function configureIntegration(
  type: IntegrationType,
  credentials: Record<string, string>
): Promise<{ configured: boolean }> {
  return fetchApi<{ configured: boolean }>(`/integrations/${type}/configure`, {
    method: 'POST',
    body: JSON.stringify({ credentials }),
  });
}

export async function removeIntegrationConfig(
  type: IntegrationType
): Promise<{ removed: boolean }> {
  return fetchApi<{ removed: boolean }>(`/integrations/${type}/configure`, {
    method: 'DELETE',
  });
}

export async function startIntegrationConnect(
  type: IntegrationType
): Promise<ConnectStartResponse> {
  return fetchApi<ConnectStartResponse>(`/integrations/${type}/connect/start`);
}

export async function getManageAccessUrl(type: IntegrationType): Promise<ConnectStartResponse> {
  return fetchApi<ConnectStartResponse>(`/integrations/${type}/manage-access`);
}

export async function syncIntegration(type: IntegrationType): Promise<SyncResponse> {
  return fetchApi<SyncResponse>(`/integrations/${type}/sync`, {
    method: 'POST',
  });
}

export async function disconnectIntegration(
  type: IntegrationType
): Promise<{ disconnected: boolean }> {
  return fetchApi<{ disconnected: boolean }>(`/integrations/${type}`, {
    method: 'DELETE',
  });
}

// GitHub-specific endpoints
export async function getGitHubRepositories(
  filter?: GitHubRepoFilter
): Promise<GitHubRepository[]> {
  return fetchApi<GitHubRepository[]>(`/integrations/github/repos${buildQueryString(filter)}`);
}

export async function getGitHubRepository(id: string): Promise<GitHubRepository> {
  return fetchApi<GitHubRepository>(`/integrations/github/repos/${id}`);
}

export async function getGitHubMembers(filter?: GitHubMemberFilter): Promise<GitHubMember[]> {
  return fetchApi<GitHubMember[]>(`/integrations/github/members${buildQueryString(filter)}`);
}

export async function getGitHubMember(id: string): Promise<GitHubMember> {
  return fetchApi<GitHubMember>(`/integrations/github/members/${id}`);
}

// ============ Members API ============

export type MemberListParams = TeamMemberListFilter;

export async function getMembers(params?: MemberListParams): Promise<TeamMemberWithUser[]> {
  return fetchApi<TeamMemberWithUser[]>(`/members${buildQueryString(params)}`);
}

export async function getMember(memberId: string): Promise<TeamMemberDetail> {
  return fetchApi<TeamMemberDetail>(`/members/${memberId}`);
}

export async function getCurrentUserRole(): Promise<{ role: TeamRole }> {
  return fetchApi<{ role: TeamRole }>('/members/current-role');
}

// ============ Repositories API ============

export async function getRepositories(
  filter?: RepositoryListFilter
): Promise<RepositoryWithStats[]> {
  return fetchApi<RepositoryWithStats[]>(`/repositories${buildQueryString(filter)}`);
}

export async function getRepository(repoId: string): Promise<RepositoryWithStats> {
  return fetchApi<RepositoryWithStats>(`/repositories/${repoId}`);
}

export async function addRepositoriesFromGitHub(
  request: AddRepositoryFromGitHubRequest
): Promise<Repository[]> {
  return fetchApi<Repository[]>('/repositories/from-github', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function syncRepository(repoId: string): Promise<RepositorySyncResponse> {
  return fetchApi<RepositorySyncResponse>(`/repositories/${repoId}/sync`, {
    method: 'POST',
    body: JSON.stringify({ repo_id: repoId }),
  });
}

export async function deleteRepository(repoId: string): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/repositories/${repoId}`, { method: 'DELETE' });
}

// ============ Commits API ============

export async function getCommits(filter?: CommitListFilter): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/commits${buildQueryString(filter)}`);
}

export async function getRepositoryCommits(
  repoId: string,
  filter?: Omit<CommitListFilter, 'repo_id'>
): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/${repoId}/commits${buildQueryString(filter)}`);
}

export async function getCommit(idOrSha: string): Promise<CommitWithRepo> {
  return fetchApi<CommitWithRepo>(`/repositories/commits/${idOrSha}`);
}

// ============ Pull Requests API ============

export async function getPullRequests(
  filter?: PullRequestListFilter
): Promise<PullRequestWithDetails[]> {
  return fetchApi<PullRequestWithDetails[]>(
    `/repositories/pull-requests${buildQueryString(filter)}`
  );
}

export async function getRepositoryPullRequests(
  repoId: string,
  filter?: Omit<PullRequestListFilter, 'repo_id'>
): Promise<PullRequestWithDetails[]> {
  return fetchApi<PullRequestWithDetails[]>(
    `/repositories/${repoId}/pull-requests${buildQueryString(filter)}`
  );
}

export async function getPullRequest(prId: string): Promise<PullRequestWithDetails> {
  return fetchApi<PullRequestWithDetails>(`/repositories/pull-requests/${prId}`);
}

export async function getPullRequestCommits(prId: string): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/pull-requests/${prId}/commits`);
}

// ============ Contributors API ============

export async function getContributors(filter?: ContributorListFilter): Promise<Contributor[]> {
  return fetchApi<Contributor[]>(`/repositories/contributors${buildQueryString(filter)}`);
}

export async function getContributor(contributorId: string): Promise<Contributor> {
  return fetchApi<Contributor>(`/repositories/contributors/${contributorId}`);
}

export async function linkContributorToMember(
  contributorId: string,
  teamMemberId: string | null
): Promise<Contributor> {
  return fetchApi<Contributor>(`/repositories/contributors/${contributorId}/link-member`, {
    method: 'POST',
    body: JSON.stringify({ team_member_id: teamMemberId }),
  });
}

export async function getContributorCommits(contributorId: string): Promise<CommitWithRepo[]> {
  return fetchApi<CommitWithRepo[]>(`/repositories/contributors/${contributorId}/commits`);
}

export async function getContributorPullRequests(
  contributorId: string
): Promise<PullRequestWithDetails[]> {
  return fetchApi<PullRequestWithDetails[]>(
    `/repositories/contributors/${contributorId}/pull-requests`
  );
}
