import type { IntegrationType, IntegrationDefinition, IntegrationSetupInfo } from '@machina/shared';
import type { IntegrationService } from './types';
import { GitHubIntegrationService } from './github';

/**
 * Registry of all supported integrations
 * Note: `available` is now always true for supported integrations -
 * configuration happens at the team level via the setup wizard
 */
export const INTEGRATION_DEFINITIONS: Record<IntegrationType, IntegrationDefinition> = {
  github: {
    type: 'github',
    name: 'GitHub',
    description: 'Connect to your GitHub organizations',
    icon: 'github',
    available: true,
    docsUrl: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app',
    features: [],
    requiredScopes: ['read:org', 'repo'],
  },
  slack: {
    type: 'slack',
    name: 'Slack',
    description: 'Connect Slack workspace for notifications and commands',
    icon: 'slack',
    available: false, // Coming soon
    features: ['notifications', 'commands'],
    requiredScopes: ['channels:read', 'chat:write'],
  },
  discord: {
    type: 'discord',
    name: 'Discord',
    description: 'Connect Discord server for notifications',
    icon: 'discord',
    available: false,
    features: ['notifications'],
    requiredScopes: ['bot'],
  },
  x: {
    type: 'x',
    name: 'X (Twitter)',
    description: 'Connect X account for social tracking',
    icon: 'twitter',
    available: false,
    features: ['posts', 'mentions'],
    requiredScopes: ['tweet.read', 'users.read'],
  },
};

/**
 * Service instances (singleton per type)
 */
const services: Map<IntegrationType, IntegrationService> = new Map();

/**
 * Get the service for an integration type
 */
export function getIntegrationService(type: IntegrationType): IntegrationService {
  let service = services.get(type);

  if (!service) {
    switch (type) {
      case 'github':
        service = new GitHubIntegrationService();
        break;
      // case 'slack':
      //   service = new SlackIntegrationService();
      //   break;
      default:
        throw new Error(`Integration type '${type}' is not implemented`);
    }
    services.set(type, service);
  }

  return service;
}

/**
 * Get setup info for the integration wizard
 */
export function getIntegrationSetupInfo(
  type: IntegrationType,
  callbackUrl: string
): IntegrationSetupInfo {
  const definition = INTEGRATION_DEFINITIONS[type];

  switch (type) {
    case 'github':
      return {
        type: 'github',
        name: definition.name,
        callbackUrl,
        steps: [
          {
            id: 'create-app',
            title: 'Create a GitHub OAuth App',
            description:
              'Go to GitHub Developer Settings and create a new OAuth App. Use the callback URL shown below.',
            externalUrl: 'https://github.com/settings/developers',
          },
          {
            id: 'enter-credentials',
            title: 'Enter your credentials',
            description: 'Copy the Client ID and Client Secret from your GitHub OAuth App.',
            fields: [
              {
                name: 'client_id',
                label: 'Client ID',
                type: 'text',
                placeholder: 'Ov23li...',
                required: true,
                helpText: 'Found in your OAuth App settings',
              },
              {
                name: 'client_secret',
                label: 'Client Secret',
                type: 'password',
                placeholder: 'Your client secret',
                required: true,
                helpText: 'Generate a new client secret if needed',
              },
            ],
          },
        ],
      };

    default:
      return {
        type,
        name: definition.name,
        callbackUrl,
        steps: [
          {
            id: 'coming-soon',
            title: 'Coming Soon',
            description: `${definition.name} integration is not yet available.`,
          },
        ],
      };
  }
}

/**
 * Get all available integrations
 */
export function getAvailableIntegrations(): IntegrationDefinition[] {
  return Object.values(INTEGRATION_DEFINITIONS).filter((d) => d.available);
}

/**
 * Check if an integration type is supported
 */
export function isIntegrationSupported(type: string): type is IntegrationType {
  return type in INTEGRATION_DEFINITIONS;
}
