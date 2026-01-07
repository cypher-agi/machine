import { useMemo } from 'react';
import type { Machine, MachineStatus } from '@machina/shared';
import { MACHINE_STATUS_PRIORITY, MACHINE_STATUS_LABELS } from '@/shared/constants';

export interface MachineGroup {
  status: MachineStatus | null;
  label?: string;
  machines: Machine[];
}

/**
 * Hook to group and sort machines by status
 * @param machines - Array of machines to group
 * @param groupByStatus - Whether to group by status or return flat list
 * @returns Array of machine groups sorted by status priority
 */
export function useMachineGroups(
  machines: Machine[] | undefined,
  groupByStatus: boolean
): MachineGroup[] | null {
  return useMemo(() => {
    if (!machines) return null;

    if (!groupByStatus) {
      // Just sort by time when not grouped
      return [
        {
          status: null,
          machines: [...machines].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
        },
      ];
    }

    // Group by status
    const groups = new Map<MachineStatus, Machine[]>();

    for (const machine of machines) {
      const status = machine.actual_status;
      if (!groups.has(status)) {
        groups.set(status, []);
      }
      groups.get(status)?.push(machine);
    }

    // Sort each group by time (newest first)
    for (const [, groupMachines] of groups) {
      groupMachines.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // Sort groups by status priority
    const sortedGroups = Array.from(groups.entries())
      .sort(([a], [b]) => MACHINE_STATUS_PRIORITY[a] - MACHINE_STATUS_PRIORITY[b])
      .map(([status, groupMachines]) => ({
        status,
        label: MACHINE_STATUS_LABELS[status],
        machines: groupMachines,
      }));

    return sortedGroups;
  }, [machines, groupByStatus]);
}
