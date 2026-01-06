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
    refetchInterval: 10000,
  });

  const activeFilterCount = Object.values(machineFilters).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col bg-cursor-bg">
      {/* Header - minimal */}
      <header className="flex-shrink-0 h-12 border-b border-cursor-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium text-text-primary">Machines</h1>
          <span className="text-xs text-text-muted font-mono">
            {machines?.length ?? 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-8 w-48 h-7 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn btn-ghost btn-sm ${
              showFilters || activeFilterCount > 0 ? 'text-accent-blue' : ''
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-medium">{activeFilterCount}</span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn btn-ghost btn-icon"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          {/* Deploy new */}
          <button
            onClick={() => setDeployWizardOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Deploy
          </button>
        </div>
      </header>

      {/* Filters panel */}
      {showFilters && (
        <MachineFilters onClose={() => setShowFilters(false)} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm text-text-muted">Loading...</span>
          </div>
        ) : machines && machines.length > 0 ? (
          <div className="space-y-1">
            {machines.map((machine) => (
              <MachineCard 
                key={machine.machine_id} 
                machine={machine}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-3">
                {searchQuery || activeFilterCount > 0
                  ? 'No machines found'
                  : 'No machines yet'}
              </p>
              {!searchQuery && activeFilterCount === 0 && (
                <button
                  onClick={() => setDeployWizardOpen(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
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
