import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Search, Filter, X, Layers } from 'lucide-react';
import { getMachines, syncMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { MachineCard, DeployWizard, MachineFilters } from './components';
import { TerminalPanel } from '@/features/terminal';
import { Button, Input } from '@/shared/ui';
import type { Machine, MachineStatus } from '@machina/shared';
import clsx from 'clsx';
import styles from './MachinesPage.module.css';

// Status priority order (lower = higher priority, shown first)
const STATUS_PRIORITY: Record<MachineStatus, number> = {
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

const STATUS_LABELS: Record<MachineStatus, string> = {
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

function MachinesPage() {
  const {
    machineFilters,
    machineSort,
    deployWizardOpen,
    setDeployWizardOpen,
    terminalMachineId,
    setTerminalMachineId,
    addToast
  } = useAppStore();

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [groupByStatus, setGroupByStatus] = useState(true);

  const syncMutation = useMutation({
    mutationFn: syncMachines,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      const changedCount = data.results.filter(r => 
        r.action !== 'no_change' && !r.action.startsWith('skipped')
      ).length;
      if (changedCount > 0) {
        addToast({ 
          type: 'success', 
          title: 'Synced', 
          message: `${changedCount} machine${changedCount !== 1 ? 's' : ''} updated` 
        });
      }
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Sync failed', message: error.message });
    }
  });

  const handleRefresh = () => {
    syncMutation.mutate();
  };

  const isSyncing = syncMutation.isPending;

  const { data: machines, isLoading } = useQuery({
    queryKey: ['machines', machineFilters, machineSort, searchQuery],
    queryFn: () => getMachines({
      ...machineFilters,
      search: searchQuery || undefined,
      sort_by: machineSort.field,
      sort_dir: machineSort.direction,
    }),
    refetchInterval: 10000,
  });

  const activeFilterCount = Object.values(machineFilters).filter(Boolean).length;

  // Group and sort machines
  const groupedMachines = useMemo(() => {
    if (!machines) return null;
    
    if (!groupByStatus) {
      // Just sort by time when not grouped
      return [{
        status: null,
        machines: [...machines].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }];
    }

    // Group by status
    const groups = new Map<MachineStatus, Machine[]>();
    
    for (const machine of machines) {
      const status = machine.actual_status;
      if (!groups.has(status)) {
        groups.set(status, []);
      }
      groups.get(status)!.push(machine);
    }

    // Sort each group by time (newest first)
    for (const [, groupMachines] of groups) {
      groupMachines.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // Sort groups by status priority
    const sortedGroups = Array.from(groups.entries())
      .sort(([a], [b]) => STATUS_PRIORITY[a] - STATUS_PRIORITY[b])
      .map(([status, groupMachines]) => ({
        status,
        label: STATUS_LABELS[status],
        machines: groupMachines
      }));

    return sortedGroups;
  }, [machines, groupByStatus]);

  return (
    <div className={styles.page}>
      {/* Main content area */}
      <div className={styles.mainArea}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Machines</h1>
            <span className={styles.count}>{machines?.length ?? 0}</span>
          </div>

          <div className={styles.headerRight}>
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
              className={clsx((showFilters || activeFilterCount > 0) && styles.headerButtonActive)}
            >
              <Filter size={14} />
              {activeFilterCount > 0 && (
                <span className={styles.filterCount}>{activeFilterCount}</span>
              )}
            </Button>

            {/* Refresh & Sync */}
            <Button 
              variant="ghost" 
              size="sm" 
              iconOnly 
              onClick={handleRefresh} 
              disabled={isSyncing}
              title="Sync with provider & refresh"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            </Button>

            {/* Deploy new */}
            <Button variant="primary" size="sm" onClick={() => setDeployWizardOpen(true)}>
              <Plus size={14} />
              Deploy
            </Button>
          </div>
        </header>

        {/* Filters panel */}
        {showFilters && <MachineFilters onClose={() => setShowFilters(false)} />}

        {/* Content */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <span className={styles.loadingText}>Loading...</span>
            </div>
          ) : groupedMachines && groupedMachines.some(g => g.machines.length > 0) ? (
            <div className={styles.list}>
              {groupedMachines.map((group) => (
                <div key={group.status || 'all'} className={styles.group}>
                  {group.status && groupByStatus && (
                    <div className={styles.groupHeader}>
                      <span className={styles.groupLabel}>{group.label}</span>
                      <span className={styles.groupCount}>{group.machines.length}</span>
                    </div>
                  )}
                  {group.machines.map((machine) => (
                    <MachineCard key={machine.machine_id} machine={machine} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyContent}>
                <p className={styles.emptyText}>
                  {searchQuery || activeFilterCount > 0 ? 'No machines found' : 'No machines yet'}
                </p>
                {!searchQuery && activeFilterCount === 0 && (
                  <Button variant="primary" size="sm" onClick={() => setDeployWizardOpen(true)}>
                    <Plus size={14} />
                    Deploy Machine
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Panel */}
      {terminalMachineId && (
        <TerminalPanel
          machineId={terminalMachineId}
          onClose={() => setTerminalMachineId(null)}
        />
      )}

      {/* Deploy Wizard Modal */}
      {deployWizardOpen && <DeployWizard onClose={() => setDeployWizardOpen(false)} />}
    </div>
  );
}

export default MachinesPage;
