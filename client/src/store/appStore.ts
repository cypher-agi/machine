import { create } from 'zustand';
import type { MachineListFilter, MachineListSort } from '@machina/shared';

interface AppState {
  // Selected machine for inspector panel
  selectedMachineId: string | null;
  setSelectedMachineId: (id: string | null) => void;

  // Machine list filters
  machineFilters: MachineListFilter;
  setMachineFilters: (filters: Partial<MachineListFilter>) => void;
  clearMachineFilters: () => void;

  // Machine list sort
  machineSort: MachineListSort;
  setMachineSort: (sort: MachineListSort) => void;

  // Deploy wizard state
  deployWizardOpen: boolean;
  setDeployWizardOpen: (open: boolean) => void;

  // Right menu state
  rightMenuOpen: boolean;
  setRightMenuOpen: (open: boolean) => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

const defaultFilters: MachineListFilter = {};
const defaultSort: MachineListSort = { field: 'created_at', direction: 'desc' };

export const useAppStore = create<AppState>((set) => ({
  // Selected machine
  selectedMachineId: null,
  setSelectedMachineId: (id) => set({ selectedMachineId: id }),

  // Machine filters
  machineFilters: defaultFilters,
  setMachineFilters: (filters) =>
    set((state) => ({
      machineFilters: { ...state.machineFilters, ...filters },
    })),
  clearMachineFilters: () => set({ machineFilters: defaultFilters }),

  // Machine sort
  machineSort: defaultSort,
  setMachineSort: (sort) => set({ machineSort: sort }),

  // Deploy wizard
  deployWizardOpen: false,
  setDeployWizardOpen: (open) => set({ deployWizardOpen: open }),

  // Right menu
  rightMenuOpen: false,
  setRightMenuOpen: (open) => set({ rightMenuOpen: open }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: Math.random().toString(36).substring(7) },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));




