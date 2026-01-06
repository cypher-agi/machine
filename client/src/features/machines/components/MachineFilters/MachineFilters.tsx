import { X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { MachineStatus, ProviderType } from '@machina/shared';
import { Input, Select, Button } from '@/shared/ui';
import clsx from 'clsx';
import styles from './MachineFilters.module.css';

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
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.filters}>
          {/* Status filter */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Status</label>
            <Select
              value={machineFilters.status || ''}
              onChange={(e) => setMachineFilters({ status: e.target.value as MachineStatus || undefined })}
              className={styles.filterInput}
              size="sm"
            >
              <option value="">All</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Provider filter */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Provider</label>
            <Select
              value={machineFilters.provider || ''}
              onChange={(e) => setMachineFilters({ provider: e.target.value as ProviderType || undefined })}
              className={styles.filterInput}
              size="sm"
            >
              <option value="">All</option>
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Region filter */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Region</label>
            <Input
              type="text"
              placeholder="e.g., nyc3"
              value={machineFilters.region || ''}
              onChange={(e) => setMachineFilters({ region: e.target.value || undefined })}
              className={clsx(styles.filterInput, styles.filterInputSm)}
              size="sm"
            />
          </div>

          {/* Sort */}
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Sort</label>
            <Select
              value={`${machineSort.field}-${machineSort.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-') as [typeof machineSort.field, 'asc' | 'desc'];
                setMachineSort({ field, direction });
              }}
              className={styles.filterInput}
              size="sm"
            >
              <option value="created_at-desc">Newest</option>
              <option value="created_at-asc">Oldest</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </Select>
          </div>

          {/* Clear */}
          <Button variant="ghost" size="sm" onClick={clearMachineFilters} className={styles.clearButton}>
            Clear
          </Button>
        </div>

        <Button variant="ghost" size="sm" iconOnly onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}
