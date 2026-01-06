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
    <div className="border-b border-cursor-border bg-cursor-surface px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-muted uppercase tracking-wider">Status</label>
            <select
              value={machineFilters.status || ''}
              onChange={(e) => setMachineFilters({ status: e.target.value as MachineStatus || undefined })}
              className="input w-28 h-7 text-xs"
            >
              <option value="">All</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Provider filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-muted uppercase tracking-wider">Provider</label>
            <select
              value={machineFilters.provider || ''}
              onChange={(e) => setMachineFilters({ provider: e.target.value as ProviderType || undefined })}
              className="input w-28 h-7 text-xs"
            >
              <option value="">All</option>
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Region filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-muted uppercase tracking-wider">Region</label>
            <input
              type="text"
              placeholder="e.g., nyc3"
              value={machineFilters.region || ''}
              onChange={(e) => setMachineFilters({ region: e.target.value || undefined })}
              className="input w-24 h-7 text-xs"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-muted uppercase tracking-wider">Sort</label>
            <select
              value={`${machineSort.field}-${machineSort.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-') as [typeof machineSort.field, 'asc' | 'desc'];
                setMachineSort({ field, direction });
              }}
              className="input w-32 h-7 text-xs"
            >
              <option value="created_at-desc">Newest</option>
              <option value="created_at-asc">Oldest</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>

          {/* Clear */}
          <button
            onClick={clearMachineFilters}
            className="text-[10px] text-text-muted hover:text-status-error"
          >
            Clear
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-secondary rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
