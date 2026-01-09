import { useMemo } from 'react';
import type { Agent, AgentStatus } from '@machina/shared';
import { AGENT_STATUS_CONFIG } from '../mock';

interface AgentGroup {
  status: AgentStatus | null;
  label: string;
  agents: Agent[];
}

// Status order for grouping
const STATUS_ORDER: AgentStatus[] = [
  'running',
  'starting',
  'paused',
  'stopping',
  'pending',
  'stopped',
  'error',
];

export function useAgentGroups(agents: Agent[] | undefined, groupByStatus: boolean): AgentGroup[] {
  return useMemo(() => {
    if (!agents || agents.length === 0) {
      return [{ status: null, label: 'All Agents', agents: [] }];
    }

    if (!groupByStatus) {
      // Return all agents in a single group, sorted by last_active_at descending
      const sortedAgents = [...agents].sort((a, b) => {
        const aTime = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
        const bTime = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
        return bTime - aTime;
      });
      return [{ status: null, label: 'All Agents', agents: sortedAgents }];
    }

    // Group by status
    const groups: AgentGroup[] = [];

    for (const status of STATUS_ORDER) {
      const statusAgents = agents.filter((a) => a.status === status);
      if (statusAgents.length > 0) {
        // Sort agents within group by last_active_at descending
        const sortedAgents = [...statusAgents].sort((a, b) => {
          const aTime = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
          const bTime = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
          return bTime - aTime;
        });

        const config = AGENT_STATUS_CONFIG[status];
        groups.push({
          status,
          label: config?.label || status,
          agents: sortedAgents,
        });
      }
    }

    return groups;
  }, [agents, groupByStatus]);
}
