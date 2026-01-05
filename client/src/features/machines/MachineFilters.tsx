import { X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { MachineStatus, ProviderType } from '@machine/shared';

interface MachineFiltersProps {
  onClose: () => void;
}

const statusOptions: { value: MachineStatus; label: string }[] = [
  { value: 'running', label: 'Running' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'pending', label: 'Pending' },
  { value: 'rebooting', label: 'Rebooting' },
  { value: 'terminating', label: 'Terminating' },
  { value: 'error', label: 'Error' },
];

const providerOptions: { value: ProviderType; label: string }[] = [
  { value: 'digitalocean', label: 'DigitalOcean' },
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'GCP' },
  { value: 'hetzner', label: 'Hetzner' },
];

export function MachineFilters({ onClose }: MachineFiltersProps) {
  const { machineFilters, setMachineFilters, clearMachineFilters, machineSort, setMachineSort } = useAppStore();

  return (
    <div className="border-b border-machine-border bg-black px-6 py-4 animate-slide-in-up">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 flex items-center gap-6 flex-wrap">
          {/* Status filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Status
            </label>
            <select
              value={machineFilters.status || ''}
              onChange={(e) => setMachineFilters({ status: e.target.value as MachineStatus || undefined })}
              className="input w-40"
            >
              <option value="">All statuses</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Provider filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Provider
            </label>
            <select
              value={machineFilters.provider || ''}
              onChange={(e) => setMachineFilters({ provider: e.target.value as ProviderType || undefined })}
              className="input w-40"
            >
              <option value="">All providers</option>
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Region filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Region
            </label>
            <input
              type="text"
              placeholder="e.g., nyc3"
              value={machineFilters.region || ''}
              onChange={(e) => setMachineFilters({ region: e.target.value || undefined })}
              className="input w-32"
            />
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Sort by
            </label>
            <select
              value={`${machineSort.field}-${machineSort.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-') as [typeof machineSort.field, 'asc' | 'desc'];
                setMachineSort({ field, direction });
              }}
              className="input w-44"
            >
              <option value="created_at-desc">Newest first</option>
              <option value="created_at-asc">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="status-asc">Status A-Z</option>
              <option value="provider-asc">Provider A-Z</option>
            </select>
          </div>

          {/* Clear filters */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider opacity-0">
              Clear
            </label>
            <button
              onClick={clearMachineFilters}
              className="btn btn-ghost btn-sm text-text-tertiary hover:text-neon-red"
            >
              Clear all
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-text-tertiary hover:text-text-secondary rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

