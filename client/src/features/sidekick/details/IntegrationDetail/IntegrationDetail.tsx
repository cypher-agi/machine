import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Github, RefreshCw, Unlink } from 'lucide-react';
import type { IntegrationType } from '@machina/shared';
import {
  getIntegrationStatus,
  syncIntegration,
  disconnectIntegration,
  getManageAccessUrl,
  getGitHubRepositories,
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Badge, Button, ConfirmModal } from '@/shared/ui';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
} from '../../components';
import { IntegrationOverview } from './IntegrationOverview';
import { IntegrationRepositories } from './IntegrationRepositories';
import { IntegrationMembers } from './IntegrationMembers';
import { IntegrationActivity } from './IntegrationActivity';
import styles from './IntegrationDetail.module.css';

export interface IntegrationDetailProps {
  integrationId: string; // This is the integration type like 'github'
  onClose: () => void;
  onMinimize: () => void;
}

type TabId = 'overview' | 'repositories' | 'members' | 'activity';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'repositories', label: 'Repos' },
  { id: 'members', label: 'Members' },
  { id: 'activity', label: 'Activity' },
];

const INTEGRATION_ICONS: Record<string, typeof Github> = {
  github: Github,
};

export function IntegrationDetail({ integrationId, onClose, onMinimize }: IntegrationDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const { currentTeamId } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const integrationType = integrationId as IntegrationType;

  const { data: status, isLoading } = useQuery({
    queryKey: ['integration-status', currentTeamId, integrationType],
    queryFn: () => getIntegrationStatus(integrationType),
  });

  // Fetch repos to extract organizations
  const { data: repos } = useQuery({
    queryKey: ['github-repos', currentTeamId],
    queryFn: () => getGitHubRepositories(),
    enabled: integrationType === 'github',
  });

  // Extract unique organizations from repos with repo counts
  const { organizations, organizationRepoCount } = useMemo(() => {
    if (!repos) return { organizations: [], organizationRepoCount: {} };
    const orgCounts: Record<string, number> = {};
    repos.forEach((repo) => {
      const org = repo.full_name.split('/')[0];
      if (org) {
        orgCounts[org] = (orgCounts[org] || 0) + 1;
      }
    });
    return {
      organizations: Object.keys(orgCounts).sort(),
      organizationRepoCount: orgCounts,
    };
  }, [repos]);

  const syncMutation = useMutation({
    mutationFn: () => syncIntegration(integrationType),
    onSuccess: (data) => {
      addToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synced ${data.items_synced || 0} items`,
      });
      queryClient.invalidateQueries({ queryKey: ['integration-status', integrationType] });
      queryClient.invalidateQueries({ queryKey: ['github-repos'] });
      queryClient.invalidateQueries({ queryKey: ['github-members'] });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Sync Failed', message: error.message });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectIntegration(integrationType),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'Disconnected',
        message: 'Integration has been disconnected',
      });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setSidekickSelection(null);
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Disconnect Failed', message: error.message });
    },
  });

  const manageAccessMutation = useMutation({
    mutationFn: () => getManageAccessUrl(integrationType),
    onSuccess: (data) => {
      // Open GitHub settings page in a new tab to manage organization access
      window.open(data.url, '_blank', 'noopener,noreferrer');
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to get manage access URL', message: error.message });
    },
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!status || !status.connected || !status.integration) {
    return <SidekickLoading message="Integration not found" />;
  }

  const { integration, stats, definition } = status;
  const Icon = INTEGRATION_ICONS[definition.icon] || Github;

  const handleDisconnect = () => {
    disconnectMutation.mutate();
    setShowDisconnectConfirm(false);
  };

  return (
    <>
      <SidekickHeader
        icon={<Icon size={18} />}
        name={definition.name}
        nameSans
        subtitle={integration.external_account_name}
        statusBadge={<Badge variant="running">Connected</Badge>}
        onClose={onClose}
        onMinimize={onMinimize}
      />

      <SidekickTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <SidekickContent>
        {activeTab === 'overview' && (
          <IntegrationOverview
            integration={integration}
            stats={stats}
            definition={definition}
            organizations={organizations}
            organizationRepoCount={organizationRepoCount}
            onManageAccess={() => manageAccessMutation.mutate()}
            isManagingAccess={manageAccessMutation.isPending}
          />
        )}
        {activeTab === 'repositories' && <IntegrationRepositories />}
        {activeTab === 'members' && <IntegrationMembers />}
        {activeTab === 'activity' && (
          <IntegrationActivity integrationId={integration.integration_id} />
        )}
      </SidekickContent>

      <SidekickActionBar spread>
        <div className={styles.actionGroup}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDisconnectConfirm(true)}
          className={styles.dangerButton}
        >
          <Unlink size={14} />
        </Button>
      </SidekickActionBar>

      <ConfirmModal
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Integration"
        message={
          <>
            Are you sure you want to disconnect <strong>{definition.name}</strong>? This will remove
            all synced data.
          </>
        }
        confirmLabel="Disconnect"
        danger
        isLoading={disconnectMutation.isPending}
      />
    </>
  );
}
