import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Search, Filter, X } from 'lucide-react';
import { getMachines } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { MachineCard } from './MachineCard';
import { DeployWizard } from './DeployWizard';
import { MachineFilters } from './MachineFilters';

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
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const activeFilterCount = Object.values(machineFilters).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-machine-border bg-black px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-text-primary">Machines</h1>
          <span className="text-sm text-text-tertiary font-mono">
            {machines?.length ?? 0} total
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search machines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-secondary btn-sm ${
              showFilters || activeFilterCount > 0 ? 'border-neon-cyan text-neon-cyan' : ''
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-neon-cyan text-machine-bg text-xs font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn btn-ghost btn-icon"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          {/* Deploy new */}
          <button
            onClick={() => setDeployWizardOpen(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Deploy Machine
          </button>
        </div>
      </header>

      {/* Filters panel */}
      {showFilters && (
        <MachineFilters onClose={() => setShowFilters(false)} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <span className="text-text-secondary animate-pulse">Loading machines...</span>
              <p className="text-text-secondary">Loading machines...</p>
            </div>
          </div>
        ) : machines && machines.length > 0 ? (
          <div className="grid gap-4">
            {machines.map((machine) => (
              <MachineCard 
                key={machine.machine_id} 
                machine={machine}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-machine-elevated border border-machine-border flex items-center justify-center">
                <Plus className="w-8 h-8 text-text-tertiary" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-text-primary mb-1">
                  No machines found
                </h3>
                <p className="text-text-secondary max-w-md">
                  {searchQuery || activeFilterCount > 0
                    ? 'Try adjusting your search or filters.'
                    : 'Deploy your first machine to get started.'}
                </p>
              </div>
              {!searchQuery && activeFilterCount === 0 && (
                <button
                  onClick={() => setDeployWizardOpen(true)}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Deploy Machine
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Deploy Wizard Modal */}
      {deployWizardOpen && (
        <DeployWizard onClose={() => setDeployWizardOpen(false)} />
      )}
    </div>
  );
}

export default MachinesPage;

