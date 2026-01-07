import { v4 as uuidv4 } from 'uuid';
import type {
  IntegrationType,
  IntegrationDefinition,
  TeamIntegration,
  GitHubRepository,
  GitHubMember,
  SyncResponse,
} from '@machina/shared';
import type { IntegrationService, IntegrationContext } from './types';
import { INTEGRATION_DEFINITIONS } from './registry';
import { database } from '../database';
import {
  encryptCredentials,
  decryptCredentials,
  generateOAuthState,
  validateOAuthState,
} from '../credentialVault';

export class GitHubIntegrationService implements IntegrationService {
  readonly type: IntegrationType = 'github';
  readonly definition: IntegrationDefinition = INTEGRATION_DEFINITIONS['github'];

  /**
   * Get the team's configured OAuth credentials
   */
  private getTeamOAuthCredentials(teamId: string): { client_id: string; client_secret: string } {
    const config = database.getOAuthConfig(teamId, 'github');
    if (!config) {
      throw new Error('GitHub OAuth credentials are not configured for this team');
    }

    try {
      // Use type as the binding ID (matches encryption in routes/integrations.ts)
      const creds = decryptCredentials(teamId, 'github', config.encrypted_credentials) as {
        client_id: string;
        client_secret: string;
      };

      if (!creds.client_id || !creds.client_secret) {
        throw new Error('Invalid OAuth credentials');
      }

      return creds;
    } catch (decryptError) {
      // If decryption fails (e.g., old encryption format), delete the corrupt config
      console.error('Failed to decrypt GitHub credentials, removing corrupt config:', decryptError);
      database.deleteOAuthConfig(teamId, 'github');
      throw new Error(
        'GitHub credentials were corrupted and have been removed. Please reconfigure.'
      );
    }
  }

  async getConnectUrl(ctx: IntegrationContext): Promise<string> {
    const { teamId, userId } = ctx;

    // Get team's OAuth credentials
    const oauthCreds = this.getTeamOAuthCredentials(teamId);

    // Generate secure state
    const state = generateOAuthState(teamId, userId);

    // Store state for validation (TTL: 10 minutes)
    database.storeOAuthState(state, teamId, userId, 10);

    // Build OAuth URL with team's client_id
    const scopes = 'read:org,repo';
    return `https://github.com/login/oauth/authorize?client_id=${oauthCreds.client_id}&scope=${scopes}&state=${encodeURIComponent(state)}`;
  }

  async getManageAccessUrl(ctx: IntegrationContext): Promise<string> {
    const { teamId } = ctx;

    // Get team's OAuth credentials to get the client_id
    const oauthCreds = this.getTeamOAuthCredentials(teamId);

    // Return the GitHub settings page where users can manage organization access for this OAuth app
    return `https://github.com/settings/connections/applications/${oauthCreds.client_id}`;
  }

  async handleCallback(
    _ctx: IntegrationContext,
    params: Record<string, string>
  ): Promise<TeamIntegration> {
    const { state, code } = params;

    if (!state) {
      throw new Error('Missing OAuth state');
    }

    // Validate state
    const stateData = validateOAuthState(state);
    if (!stateData) {
      throw new Error('Invalid or expired OAuth state');
    }

    // Clean up state
    database.deleteOAuthState(state);

    // Use the team ID from the state (more secure than from request)
    const teamId = stateData.teamId;
    const userId = stateData.userId;

    if (!code) {
      throw new Error('Missing authorization code');
    }

    // Get team's OAuth credentials
    const oauthCreds = this.getTeamOAuthCredentials(teamId);

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: oauthCreds.client_id,
        client_secret: oauthCreds.client_secret,
        code,
      }),
    });

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Failed to get access token');
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const userData = (await userResponse.json()) as {
      id: number;
      login: string;
      avatar_url: string;
    };

    const now = new Date().toISOString();

    // Check if already connected - if so, update credentials (re-authorization)
    const existing = database.getTeamIntegration(teamId, 'github');

    if (existing && existing.status === 'active') {
      // Re-authorization: update credentials with new access token
      const encrypted = encryptCredentials(teamId, existing.integration_id, {
        access_token: tokenData.access_token,
      });
      database.storeIntegrationCredentials(existing.integration_id, encrypted);

      // Update integration metadata
      database.updateTeamIntegration({
        integration_id: existing.integration_id,
        external_account_name: userData.login,
        external_account_avatar: userData.avatar_url,
        updated_at: now,
      });

      // Log audit event for re-authorization
      database.insertAuditEvent({
        event_id: `evt_${uuidv4()}`,
        action: 'integration.reauthorized',
        outcome: 'success',
        actor_id: userId,
        actor_type: 'user',
        actor_name: userData.login,
        target_type: 'integration',
        target_id: existing.integration_id,
        target_name: `github:${userData.login}`,
        timestamp: now,
        details: {
          integration_type: 'github',
          external_account: userData.login,
          reason: 'organization_access_update',
        },
      });

      return { ...existing, updated_at: now };
    }

    // New connection
    const integrationId = `int_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

    const integration: TeamIntegration = {
      integration_id: integrationId,
      team_id: teamId,
      type: 'github',
      status: 'active',
      external_id: String(userData.id),
      external_account_id: String(userData.id),
      external_account_name: userData.login,
      external_account_avatar: userData.avatar_url,
      connected_by_user_id: userId,
      connected_by_external_id: String(userData.id),
      connected_by_external_name: userData.login,
      config: {},
      created_at: now,
      updated_at: now,
    };

    // Store integration
    database.insertTeamIntegration(integration);

    // Store credentials (access token)
    const encrypted = encryptCredentials(teamId, integrationId, {
      access_token: tokenData.access_token,
    });
    database.storeIntegrationCredentials(integrationId, encrypted);

    // Log audit event
    database.insertAuditEvent({
      event_id: `evt_${uuidv4()}`,
      action: 'integration.connected',
      outcome: 'success',
      actor_id: userId,
      actor_type: 'user',
      actor_name: userData.login,
      target_type: 'integration',
      target_id: integrationId,
      target_name: `github:${userData.login}`,
      timestamp: now,
      details: {
        integration_type: 'github',
        external_account: userData.login,
      },
    });

    return integration;
  }

  async disconnect(ctx: IntegrationContext, integrationId: string): Promise<void> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration || integration.team_id !== ctx.teamId) {
      throw new Error('Integration not found');
    }

    // Mark as disconnected (soft delete)
    database.updateTeamIntegration({
      integration_id: integrationId,
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    });

    // Delete credentials
    database.deleteIntegrationCredentials(integrationId);

    // Mark all synced data as removed
    database.markAllGitHubDataRemoved(integrationId);

    // Log audit event
    database.insertAuditEvent({
      event_id: `evt_${uuidv4()}`,
      action: 'integration.disconnected',
      outcome: 'success',
      actor_id: ctx.userId,
      actor_type: 'user',
      actor_name: ctx.userName,
      target_type: 'integration',
      target_id: integrationId,
      target_name: `github:${integration.external_account_name}`,
      timestamp: new Date().toISOString(),
    });
  }

  async sync(ctx: IntegrationContext, integrationId: string): Promise<SyncResponse> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration || integration.team_id !== ctx.teamId) {
      throw new Error('Integration not found');
    }

    const startedAt = new Date().toISOString();

    // Mark sync in progress
    database.updateTeamIntegration({
      integration_id: integrationId,
      last_sync_status: 'in_progress',
      updated_at: startedAt,
    });

    try {
      // Get credentials
      const encryptedCreds = database.getIntegrationCredentials(integrationId);
      if (!encryptedCreds) {
        throw new Error('Credentials not found');
      }

      const creds = decryptCredentials(ctx.teamId, integrationId, encryptedCreds) as {
        access_token?: string;
      };

      let reposSynced = 0;
      let membersSynced = 0;

      if (creds.access_token) {
        reposSynced = await this.syncRepositoriesOAuth(creds.access_token, integration, ctx.teamId);
        membersSynced = await this.syncMembersOAuth(creds.access_token, integration, ctx.teamId);
      }

      // Update integration
      database.updateTeamIntegration({
        integration_id: integrationId,
        last_sync_at: startedAt,
        last_sync_status: 'success',
        last_sync_error: undefined,
        updated_at: new Date().toISOString(),
      });

      // Log audit
      database.insertAuditEvent({
        event_id: `evt_${uuidv4()}`,
        action: 'integration.synced',
        outcome: 'success',
        actor_id: ctx.userId,
        actor_type: 'user',
        actor_name: ctx.userName,
        target_type: 'integration',
        target_id: integrationId,
        target_name: `github:${integration.external_account_name}`,
        timestamp: new Date().toISOString(),
        details: {
          repos_synced: reposSynced,
          members_synced: membersSynced,
        },
      });

      return {
        success: true,
        started_at: startedAt,
        items_synced: reposSynced + membersSynced,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      database.updateTeamIntegration({
        integration_id: integrationId,
        last_sync_at: startedAt,
        last_sync_status: 'error',
        last_sync_error: message,
        updated_at: new Date().toISOString(),
      });

      throw error;
    }
  }

  private async syncRepositoriesOAuth(
    accessToken: string,
    integration: TeamIntegration,
    teamId: string
  ): Promise<number> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    };

    type RepoData = {
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      archived: boolean;
      disabled: boolean;
      default_branch: string;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      pushed_at: string | null;
    };

    const allRepos: RepoData[] = [];
    const seenIds = new Set<number>();

    // 1. Fetch user's personal repos
    const userReposResponse = await fetch(
      'https://api.github.com/user/repos?per_page=100&type=owner',
      {
        headers,
      }
    );
    if (userReposResponse.ok) {
      const userRepos = (await userReposResponse.json()) as RepoData[];
      for (const repo of userRepos) {
        if (!seenIds.has(repo.id)) {
          seenIds.add(repo.id);
          allRepos.push(repo);
        }
      }
    }

    // 2. Fetch all organizations the user has access to
    const orgsResponse = await fetch('https://api.github.com/user/orgs?per_page=100', {
      headers,
    });

    if (orgsResponse.ok) {
      const orgs = (await orgsResponse.json()) as Array<{ login: string }>;

      // 3. Fetch repos from each organization
      for (const org of orgs) {
        try {
          const orgReposResponse = await fetch(
            `https://api.github.com/orgs/${org.login}/repos?per_page=100&type=all`,
            { headers }
          );

          if (orgReposResponse.ok) {
            const orgRepos = (await orgReposResponse.json()) as RepoData[];
            for (const repo of orgRepos) {
              if (!seenIds.has(repo.id)) {
                seenIds.add(repo.id);
                allRepos.push(repo);
              }
            }
          }
        } catch (err) {
          // Continue if we can't access an org's repos
          console.warn(`Failed to fetch repos for org ${org.login}:`, err);
        }
      }
    }

    const activeIds: number[] = [];
    const now = new Date().toISOString();

    for (const repo of allRepos) {
      activeIds.push(repo.id);

      const repoData: GitHubRepository = {
        repo_id: `ghr_${repo.id}`,
        team_id: teamId,
        integration_id: integration.integration_id,
        github_repo_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || undefined,
        private: repo.private,
        archived: repo.archived || false,
        disabled: repo.disabled || false,
        default_branch: repo.default_branch || 'main',
        html_url: repo.html_url,
        language: repo.language || undefined,
        stargazers_count: repo.stargazers_count || 0,
        forks_count: repo.forks_count || 0,
        open_issues_count: repo.open_issues_count || 0,
        pushed_at: repo.pushed_at || undefined,
        sync_status: 'ok',
        imported_at: now,
        updated_at: now,
      };

      database.upsertGitHubRepository(repoData);
    }

    // Mark removed repos
    database.markRemovedGitHubRepositories(integration.integration_id, activeIds);

    return allRepos.length;
  }

  private async syncMembersOAuth(
    accessToken: string,
    integration: TeamIntegration,
    teamId: string
  ): Promise<number> {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    };

    // Clear existing members for this integration to handle schema migration
    // (old data might have different member_id format or constraint issues)
    database.clearGitHubMembers(integration.integration_id);

    let totalMembers = 0;
    const now = new Date().toISOString();
    const activeMemberIds: string[] = [];

    // First, get the authenticated user and add them under their personal space
    try {
      const userResponse = await fetch('https://api.github.com/user', { headers });
      if (userResponse.ok) {
        const user = (await userResponse.json()) as {
          id: number;
          login: string;
          avatar_url: string;
          html_url: string;
        };

        // Add the user under their own personal space (username as org)
        const memberId = `ghm_${user.login}_${user.id}`;
        activeMemberIds.push(memberId);

        const memberData: GitHubMember = {
          member_id: memberId,
          team_id: teamId,
          integration_id: integration.integration_id,
          github_user_id: user.id,
          login: user.login,
          avatar_url: user.avatar_url,
          html_url: user.html_url,
          organization: user.login,
          role: 'admin',
          sync_status: 'ok',
          imported_at: now,
          updated_at: now,
        };

        database.upsertGitHubMember(memberData);
        totalMembers++;
      }
    } catch (err) {
      console.warn('Failed to fetch authenticated user:', err);
    }

    // Get user's organizations
    const orgsResponse = await fetch('https://api.github.com/user/orgs?per_page=100', {
      headers,
    });

    if (orgsResponse.ok) {
      const orgs = (await orgsResponse.json()) as Array<{ login: string }>;

      // Sync members from EACH organization separately
      // A member can appear in multiple orgs, and we store them separately
      for (const org of orgs) {
        try {
          const membersResponse = await fetch(
            `https://api.github.com/orgs/${org.login}/members?per_page=100`,
            { headers }
          );

          if (membersResponse.ok) {
            const members = (await membersResponse.json()) as Array<{
              id: number;
              login: string;
              avatar_url: string;
              html_url: string;
            }>;

            for (const member of members) {
              // Include org in member_id so each member-org combo is unique
              const memberId = `ghm_${org.login}_${member.id}`;
              activeMemberIds.push(memberId);

              const memberData: GitHubMember = {
                member_id: memberId,
                team_id: teamId,
                integration_id: integration.integration_id,
                github_user_id: member.id,
                login: member.login,
                avatar_url: member.avatar_url,
                html_url: member.html_url,
                organization: org.login,
                role: 'member',
                sync_status: 'ok',
                imported_at: now,
                updated_at: now,
              };

              database.upsertGitHubMember(memberData);
              totalMembers++;
            }
          }
        } catch (err) {
          // Continue if we can't access an org's members
          console.warn(`Failed to fetch members for org ${org.login}:`, err);
        }
      }
    }

    // Mark removed members by member_id
    database.markRemovedGitHubMembersByIds(integration.integration_id, activeMemberIds);

    return totalMembers;
  }

  async getSyncStatus(integrationId: string): Promise<{
    status: 'idle' | 'in_progress';
    progress?: number;
    last_sync_at?: string;
  }> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    return {
      status: integration.last_sync_status === 'in_progress' ? 'in_progress' : 'idle',
      last_sync_at: integration.last_sync_at,
    };
  }

  async verify(ctx: IntegrationContext, integrationId: string): Promise<boolean> {
    const integration = database.getTeamIntegrationById(integrationId);
    if (!integration || integration.team_id !== ctx.teamId) {
      return false;
    }

    try {
      const encryptedCreds = database.getIntegrationCredentials(integrationId);
      if (!encryptedCreds) {
        return false;
      }

      const creds = decryptCredentials(ctx.teamId, integrationId, encryptedCreds) as {
        access_token?: string;
      };

      if (creds.access_token) {
        // Verify OAuth token
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${creds.access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        return response.ok;
      }

      return false;
    } catch {
      return false;
    }
  }
}
