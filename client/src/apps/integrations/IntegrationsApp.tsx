import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Github,
  MessageSquare,
  Headphones,
  Twitter,
  RefreshCw,
  Unlink,
  CheckCircle,
  Circle,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { IntegrationListItem, IntegrationType } from '@machina/shared';
import {
  getIntegrations,
  getIntegrationStatus,
  syncIntegration,
  disconnectIntegration,
  removeIntegrationConfig,
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, RefreshButton, ConfirmModal } from '@/shared/ui';
import {
  PageLayout,
  PageEmptyState,
  PageList,
  ItemCard,
  ItemCardMeta,
  ItemCardStatus,
  ItemCardBadge,
} from '@/shared/components';
import { ConnectIntegrationModal } from './components';

const INTEGRATION_ICONS: Record<string, typeof Github> = {
  github: Github,
  slack: MessageSquare,
  discord: Headphones,
  x: Twitter,
};

export function IntegrationsApp() {
  const { addToast, setSidekickSelection } = useAppStore();
  const { currentTeamId } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connectingIntegration, setConnectingIntegration] = useState<{
    type: IntegrationType;
    name: string;
    configured: boolean;
  } | null>(null);

  // Check for connection result in URL
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected) {
      addToast({
        type: 'success',
        title: 'Integration Connected',
        message: `${connected} has been successfully connected`,
      });
      setSearchParams({});
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    }

    if (error) {
      addToast({
        type: 'error',
        title: 'Connection Failed',
        message: error,
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, addToast, queryClient]);

  const {
    data: integrations,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['integrations', currentTeamId],
    queryFn: getIntegrations,
  });

  const syncMutation = useMutation({
    mutationFn: (type: IntegrationType) => syncIntegration(type),
    onSuccess: (data, type) => {
      addToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synced ${data.items_synced || 0} items from ${type}`,
      });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integration-status', type] });
      setSyncing(null);
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Sync Failed',
        message: error.message,
      });
      setSyncing(null);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (type: IntegrationType) => disconnectIntegration(type),
    onSuccess: (_, type) => {
      addToast({
        type: 'success',
        title: 'Disconnected',
        message: `${type} has been disconnected`,
      });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setDisconnecting(null);
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Disconnect Failed',
        message: error.message,
      });
      setDisconnecting(null);
    },
  });

  const removeConfigMutation = useMutation({
    mutationFn: (type: IntegrationType) => removeIntegrationConfig(type),
    onSuccess: (_, type) => {
      addToast({
        type: 'success',
        title: 'Configuration Removed',
        message: `${type} credentials have been removed`,
      });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Remove Failed',
        message: error.message,
      });
    },
  });

  const handleConnect = (integration: IntegrationListItem) => {
    setConnectingIntegration({
      type: integration.type,
      name: integration.name,
      configured: integration.configured,
    });
  };

  const handleSync = (type: IntegrationType, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(type);
    syncMutation.mutate(type);
  };

  const handleDisconnect = (type: IntegrationType) => {
    disconnectMutation.mutate(type);
    setDisconnecting(null);
  };

  const connectedCount = integrations?.filter((i) => i.connected).length ?? 0;

  return (
    <PageLayout
      title="Integrations"
      count={connectedCount}
      isLoading={isLoading}
      actions={<RefreshButton onRefresh={() => refetch()} isRefreshing={isRefetching} />}
    >
      {integrations && integrations.length > 0 ? (
        <PageList>
          {integrations.map((integration) => (
            <IntegrationItem
              key={integration.type}
              integration={integration}
              onConnect={() => handleConnect(integration)}
              onSync={(e) => handleSync(integration.type, e)}
              onDisconnect={() => setDisconnecting(integration.type)}
              onRemoveConfig={() => removeConfigMutation.mutate(integration.type)}
              onSelect={() => {
                if (integration.connected) {
                  setSidekickSelection({ type: 'integration', id: integration.type });
                }
              }}
              isSyncing={syncing === integration.type}
            />
          ))}
        </PageList>
      ) : (
        <PageEmptyState title="No integrations available" />
      )}

      {/* Connect Modal */}
      {connectingIntegration && (
        <ConnectIntegrationModal
          type={connectingIntegration.type}
          name={connectingIntegration.name}
          isConfigured={connectingIntegration.configured}
          onClose={() => setConnectingIntegration(null)}
        />
      )}

      {/* Disconnect Confirmation */}
      {disconnecting && (
        <ConfirmModal
          isOpen={true}
          title="Disconnect Integration"
          message={`Are you sure you want to disconnect ${disconnecting}? This will remove all synced data.`}
          confirmLabel="Disconnect"
          danger
          onConfirm={() => handleDisconnect(disconnecting as IntegrationType)}
          onClose={() => setDisconnecting(null)}
        />
      )}
    </PageLayout>
  );
}

interface IntegrationItemProps {
  integration: IntegrationListItem;
  onConnect: () => void;
  onSync: (e: React.MouseEvent) => void;
  onDisconnect: () => void;
  onRemoveConfig: () => void;
  onSelect: () => void;
  isSyncing: boolean;
}

function IntegrationItem({
  integration,
  onConnect,
  onSync,
  onDisconnect,
  onRemoveConfig,
  onSelect,
  isSyncing,
}: IntegrationItemProps) {
  const Icon = INTEGRATION_ICONS[integration.icon] || Github;

  // Fetch detailed status for connected integrations
  const { data: status } = useQuery({
    queryKey: ['integration-status', integration.type],
    queryFn: () => getIntegrationStatus(integration.type),
    enabled: integration.connected,
    refetchInterval: isSyncing ? 2000 : false,
  });

  const getStatusVariant = (): 'valid' | 'muted' | 'warning' => {
    if (!integration.available) return 'muted';
    if (integration.connected) return 'valid';
    if (integration.configured) return 'warning';
    return 'muted';
  };

  const getStatusText = (): string => {
    if (!integration.available) return 'Coming Soon';
    if (integration.connected) return 'Connected';
    if (integration.configured) return 'Ready to Connect';
    return 'Not Configured';
  };

  return (
    <ItemCard
      iconBadge={<Icon size={14} />}
      title={integration.name}
      titleSans
      onClick={integration.connected ? onSelect : undefined}
      statusBadge={
        <ItemCardStatus variant={getStatusVariant()}>
          {integration.connected ? (
            <CheckCircle size={12} />
          ) : integration.configured ? (
            <Settings size={12} />
          ) : (
            <Circle size={12} />
          )}
          {getStatusText()}
        </ItemCardStatus>
      }
      meta={
        <>
          <ItemCardMeta>{integration.description}</ItemCardMeta>
          {integration.connected && status?.integration?.last_sync_at && (
            <ItemCardMeta>
              {isSyncing ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  Synced{' '}
                  {formatDistanceToNow(new Date(status.integration.last_sync_at), {
                    addSuffix: true,
                  })}
                </>
              )}
            </ItemCardMeta>
          )}
        </>
      }
      badges={
        <>
          {integration.features.map((feature) => (
            <ItemCardBadge key={feature}>{feature}</ItemCardBadge>
          ))}
          {integration.connected && status?.stats && (
            <>
              {Object.entries(status.stats).map(([key, value]) => (
                <ItemCardBadge key={key}>
                  {value} {key}
                </ItemCardBadge>
              ))}
            </>
          )}
        </>
      }
      actions={
        integration.available ? (
          integration.connected ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onSync}
                disabled={isSyncing}
                title="Sync"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={(e) => {
                  e.stopPropagation();
                  onDisconnect();
                }}
                title="Disconnect"
              >
                <Unlink size={14} />
              </Button>
            </>
          ) : integration.configured ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveConfig();
                }}
                title="Remove credentials"
              >
                <RotateCcw size={14} />
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect();
                }}
              >
                Connect
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onConnect();
              }}
            >
              Set Up
            </Button>
          )
        ) : undefined
      }
      actionsAlwaysVisible={!integration.connected}
    />
  );
}
