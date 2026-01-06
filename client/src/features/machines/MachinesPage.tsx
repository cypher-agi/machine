import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Search, Filter, X } from 'lucide-react';
import { getMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { MachineCard, DeployWizard, MachineFilters } from './components';
import { Button, Input } from '@/shared/ui';
import clsx from 'clsx';
import styles from './MachinesPage.module.css';

function MachinesPage() {
  const {
    machineFilters,
    machineSort,
    deployWizardOpen,
    setDeployWizardOpen
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: machines, isLoading, refetch, isRefetching } = useQuery({
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

  return (
    <div className={styles.page}>
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

          {/* Filter toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(showFilters || activeFilterCount > 0 ? styles.filterButtonActive : '')}
          >
            <Filter size={14} />
            {activeFilterCount > 0 && (
              <span className={styles.filterCount}>{activeFilterCount}</span>
            )}
          </Button>

          {/* Refresh */}
          <Button variant="ghost" size="sm" iconOnly onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
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
        ) : machines && machines.length > 0 ? (
          <div className={styles.list}>
            {machines.map((machine) => (
              <MachineCard key={machine.machine_id} machine={machine} />
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

      {/* Deploy Wizard Modal */}
      {deployWizardOpen && <DeployWizard onClose={() => setDeployWizardOpen(false)} />}
    </div>
  );
}

export default MachinesPage;
