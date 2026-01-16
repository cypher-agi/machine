import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { getDeployments, getMachines, getMembers } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Select, RefreshButton } from '@/shared/ui';
import {
  Page,
  PageEmptyState,
  PageList,
  ItemCard,
  ItemCardMeta,
  ItemCardStatus,
} from '@/shared';
import { DEPLOYMENT_STATE_CONFIG, DEPLOYMENT_TYPE_LABELS } from '@/shared/constants';
import type { DeploymentState, DeploymentType } from '@machina/shared';
import styles from './DeploymentsApp.module.css';

export function DeploymentsApp() {
  const { sidekickSelection, setSidekickSelection } = useAppStore();
  const { currentTeamId } = useAuthStore();
  const [filterState, setFilterState] = useState<DeploymentState | ''>('');
  const [filterType, setFilterType] = useState<DeploymentType | ''>('');

  const {
    data: deployments,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['deployments', currentTeamId, { state: filterState, type: filterType }],
    queryFn: () =>
      getDeployments({
        ...(filterState && { state: filterState }),
        ...(filterType && { type: filterType }),
      }),
    refetchInterval: 5000,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines', currentTeamId],
    queryFn: () => getMachines(),
  });

  const { data: members } = useQuery({
    queryKey: ['members', currentTeamId],
    queryFn: () => getMembers(),
  });

  // Create a lookup map from user_id to display_name
  const userDisplayNames = useMemo(() => {
    const map = new Map<string, string>();
    if (members) {
      for (const member of members) {
        map.set(member.user_id, member.user.display_name);
      }
    }
    return map;
  }, [members]);

  const getMachineName = (machineId?: string) => {
    if (!machineId) return 'Unknown';
    return machines?.find((m) => m.machine_id === machineId)?.name || machineId.substring(0, 12);
  };

  const getUserDisplayName = (userId?: string) => {
    if (!userId) return undefined;
    return userDisplayNames.get(userId) || userId.substring(0, 12);
  };

  const handleSelectDeployment = (deploymentId: string) => {
    setSidekickSelection({ type: 'deployment', id: deploymentId });
  };

  return (
    <Page
      title="Deployments"
      count={deployments?.length ?? 0}
      isLoading={isLoading}
      actions={
        <>
          <Select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value as DeploymentState | '')}
            size="sm"
            className={styles.filterSelect}
          >
            <option value="">All states</option>
            {Object.entries(DEPLOYMENT_STATE_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </Select>

          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DeploymentType | '')}
            size="sm"
            className={styles.filterSelect}
          >
            <option value="">All types</option>
            {Object.entries(DEPLOYMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <RefreshButton onRefresh={() => refetch()} isRefreshing={isRefetching} />
        </>
      }
    >
      {deployments && deployments.length > 0 ? (
        <PageList>
          {deployments.map((deployment) => {
            const state = DEPLOYMENT_STATE_CONFIG[deployment.state];
            const StateIcon = state.icon;
            const isInProgress = deployment.state === 'planning' || deployment.state === 'applying';
            const isSelected =
              sidekickSelection?.type === 'deployment' &&
              sidekickSelection?.id === deployment.deployment_id;

            return (
              <ItemCard
                key={deployment.deployment_id}
                selected={isSelected}
                onClick={() => handleSelectDeployment(deployment.deployment_id)}
                iconBadge={<StateIcon size={14} className={isInProgress ? 'animate-spin' : ''} />}
                title={DEPLOYMENT_TYPE_LABELS[deployment.type]}
                titleSans
                statusBadge={<ItemCardStatus variant={state.variant}>{state.label}</ItemCardStatus>}
                meta={
                  <>
                    <ItemCardMeta mono>{getMachineName(deployment.machine_id)}</ItemCardMeta>
                    <ItemCardMeta>
                      {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true })}
                    </ItemCardMeta>
                    {deployment.initiated_by && (
                      <ItemCardMeta>by {getUserDisplayName(deployment.initiated_by)}</ItemCardMeta>
                    )}
                  </>
                }
                secondary={
                  deployment.plan_summary && (
                    <div className={styles.planSummary}>
                      {deployment.plan_summary.resources_to_add > 0 && (
                        <span className={styles.planAdd}>
                          +{deployment.plan_summary.resources_to_add}
                        </span>
                      )}
                      {deployment.plan_summary.resources_to_change > 0 && (
                        <span className={styles.planChange}>
                          ~{deployment.plan_summary.resources_to_change}
                        </span>
                      )}
                      {deployment.plan_summary.resources_to_destroy > 0 && (
                        <span className={styles.planDestroy}>
                          -{deployment.plan_summary.resources_to_destroy}
                        </span>
                      )}
                    </div>
                  )
                }
              />
            );
          })}
        </PageList>
      ) : (
        <PageEmptyState
          title={filterState || filterType ? 'No matching deployments' : 'No deployments yet'}
        />
      )}
    </Page>
  );
}
