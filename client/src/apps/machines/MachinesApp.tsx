import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, X, Layers } from 'lucide-react';
import { getMachines, syncMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { MachineCard, DeployWizard, MachineFilters } from './components';
import { useMachineGroups } from './hooks';
import { TerminalPanel } from '@/features/terminal';
import { Button, Input, RefreshButton } from '@/shared/ui';
import { Page, PageEmptyState, PageList, CollapsibleGroup } from '@/shared/components';
import clsx from 'clsx';
import styles from './MachinesApp.module.css';

export function MachinesApp() {
  const {
    machineFilters,
    machineSort,
    deployWizardOpen,
    setDeployWizardOpen,
    terminalMachineId,
    setTerminalMachineId,
    addToast,
  } = useAppStore();
  const { currentTeamId } = useAuthStore();

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [groupByStatus, setGroupByStatus] = useState(true);

  const syncMutation = useMutation({
    mutationFn: syncMachines,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      const changedCount = data.results.filter(
        (r) => r.action !== 'no_change' && !r.action.startsWith('skipped')
      ).length;
      if (changedCount > 0) {
        addToast({
          type: 'success',
          title: 'Synced',
          message: `${changedCount} machine${changedCount !== 1 ? 's' : ''} updated`,
        });
      }
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Sync failed', message: error.message });
    },
  });

  const handleRefresh = () => {
    syncMutation.mutate();
  };

  const isSyncing = syncMutation.isPending;

  const { data: machines, isLoading } = useQuery({
    queryKey: ['machines', currentTeamId, machineFilters, machineSort, searchQuery],
    queryFn: () =>
      getMachines({
        ...machineFilters,
        ...(searchQuery && { search: searchQuery }),
        sort_by: machineSort.field,
        sort_dir: machineSort.direction,
      }),
    refetchInterval: 10000,
  });

  const activeFilterCount = Object.values(machineFilters).filter(Boolean).length;

  // Group and sort machines using the hook
  const groupedMachines = useMachineGroups(machines, groupByStatus);

  return (
    <div className={styles.pageContainer}>
      {/* Main content area */}
      <div className={styles.mainArea}>
        <Page
          title="Machines"
          count={machines?.length ?? 0}
          isLoading={isLoading}
          actions={
            <>
              {/* Search */}
              <div className={styles.searchContainer}>
                <Search size={14} className={styles.searchIcon} />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                  size="sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Group by status toggle */}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => setGroupByStatus(!groupByStatus)}
                className={clsx(groupByStatus && styles.headerButtonActive)}
                title={groupByStatus ? 'Grouped by status' : 'Not grouped'}
              >
                <Layers size={14} />
              </Button>

              {/* Filter toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  (showFilters || activeFilterCount > 0) && styles.headerButtonActive
                )}
              >
                <Filter size={14} />
                {activeFilterCount > 0 && (
                  <span className={styles.filterCount}>{activeFilterCount}</span>
                )}
              </Button>

              {/* Refresh & Sync */}
              <RefreshButton
                onRefresh={handleRefresh}
                isRefreshing={isSyncing}
                title="Sync with provider & refresh"
              />

              {/* Deploy new */}
              <Button variant="primary" size="sm" onClick={() => setDeployWizardOpen(true)}>
                <Plus size={14} />
                Deploy
              </Button>
            </>
          }
        >
          {/* Filters panel */}
          {showFilters && <MachineFilters onClose={() => setShowFilters(false)} />}

          {/* Content */}
          {groupedMachines && groupedMachines.some((g) => g.machines.length > 0) ? (
            <PageList>
              {groupedMachines.map((group) =>
                group.status && groupByStatus ? (
                  <CollapsibleGroup
                    key={group.status}
                    label={group.label}
                    count={group.machines.length}
                  >
                    {group.machines.map((machine) => (
                      <MachineCard key={machine.machine_id} machine={machine} />
                    ))}
                  </CollapsibleGroup>
                ) : (
                  <div key="all">
                    {group.machines.map((machine) => (
                      <MachineCard key={machine.machine_id} machine={machine} />
                    ))}
                  </div>
                )
              )}
            </PageList>
          ) : (
            <PageEmptyState
              title={searchQuery || activeFilterCount > 0 ? 'No machines found' : 'No machines yet'}
              actions={
                !searchQuery && activeFilterCount === 0 ? (
                  <Button variant="primary" size="sm" onClick={() => setDeployWizardOpen(true)}>
                    <Plus size={14} />
                    Deploy Machine
                  </Button>
                ) : undefined
              }
            />
          )}
        </Page>
      </div>

      {/* Terminal Panel */}
      {terminalMachineId && (
        <TerminalPanel machineId={terminalMachineId} onClose={() => setTerminalMachineId(null)} />
      )}

      {/* Deploy Wizard Modal */}
      {deployWizardOpen && <DeployWizard onClose={() => setDeployWizardOpen(false)} />}
    </div>
  );
}
