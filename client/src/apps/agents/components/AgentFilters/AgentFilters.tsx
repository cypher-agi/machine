import { X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Select } from '@/shared';
import type { AgentStatus, ReasoningProvider } from '@machina/shared';
import { mockSwarms, AGENT_STATUS_CONFIG, AI_PROVIDER_CONFIG } from '../../mock';
import styles from './AgentFilters.module.css';

interface AgentFiltersProps {
  onClose: () => void;
}

export function AgentFilters({ onClose }: AgentFiltersProps) {
  const { agentFilters, setAgentFilters, clearAgentFilters } = useAppStore();

  const activeFilterCount = Object.values(agentFilters).filter(
    (v) => v !== undefined && v !== ''
  ).length;

  return (
    <div className={styles.filters}>
      <div className={styles.filtersHeader}>
        <span className={styles.filtersTitle}>Filters</span>
        {activeFilterCount > 0 && (
          <button onClick={clearAgentFilters} className={styles.clearButton}>
            Clear all
          </button>
        )}
        <button onClick={onClose} className={styles.closeButton}>
          <X size={14} />
        </button>
      </div>

      <div className={styles.filtersGrid}>
        {/* Status filter */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status</label>
          <Select
            value={agentFilters.status || ''}
            onChange={(e) =>
              setAgentFilters({ status: (e.target.value as AgentStatus) || undefined })
            }
            size="sm"
          >
            <option value="">All statuses</option>
            {Object.entries(AGENT_STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Swarm filter */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Swarm</label>
          <Select
            value={agentFilters.swarm_id || ''}
            onChange={(e) => setAgentFilters({ swarm_id: e.target.value || undefined })}
            size="sm"
          >
            <option value="">All swarms</option>
            {mockSwarms.map((swarm) => (
              <option key={swarm.swarm_id} value={swarm.swarm_id}>
                {swarm.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Provider filter */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>AI Provider</label>
          <Select
            value={agentFilters.provider || ''}
            onChange={(e) =>
              setAgentFilters({ provider: (e.target.value as ReasoningProvider) || undefined })
            }
            size="sm"
          >
            <option value="">All providers</option>
            {Object.entries(AI_PROVIDER_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Has Wallet filter */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Has Wallet</label>
          <Select
            value={agentFilters.has_wallet === undefined ? '' : agentFilters.has_wallet.toString()}
            onChange={(e) =>
              setAgentFilters({
                has_wallet: e.target.value === '' ? undefined : e.target.value === 'true',
              })
            }
            size="sm"
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </div>
      </div>
    </div>
  );
}
