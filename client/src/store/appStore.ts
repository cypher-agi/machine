import { create } from 'zustand';
import type { MachineListFilter, MachineListSort } from '@machina/shared';
import type { Toast } from '@/shared/components';
import type { ProfileSettingsTab } from '@/features/profile/types';

// Item types that can be selected and shown in the Sidekick
export type SidekickItemType =
  | 'machine'
  | 'provider'
  | 'key'
  | 'deployment'
  | 'bootstrap'
  | 'team'
  | 'integration'
  | 'member'
  | 'repository'
  | 'commit'
  | 'pull_request'
  | 'contributor';

export interface SidekickSelection {
  type: SidekickItemType;
  id: string;
}

interface AppState {
  // Selected item for sidekick panel (generic)
  sidekickSelection: SidekickSelection | null;
  setSidekickSelection: (selection: SidekickSelection | null) => void;

  // Terminal panel state
  terminalMachineId: string | null;
  setTerminalMachineId: (id: string | null) => void;

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

  // Profile settings modal
  profileModalOpen: boolean;
  profileModalTab: ProfileSettingsTab;
  openProfileModal: (tab?: ProfileSettingsTab) => void;
  closeProfileModal: () => void;
  setProfileModalTab: (tab: ProfileSettingsTab) => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const defaultFilters: MachineListFilter = {};
const defaultSort: MachineListSort = { field: 'created_at', direction: 'desc' };

export const useAppStore = create<AppState>((set) => ({
  // Sidekick selection (generic)
  sidekickSelection: null,
  setSidekickSelection: (selection) =>
    set({
      sidekickSelection: selection,
      // Open terminal when selecting a machine
      terminalMachineId: selection?.type === 'machine' ? selection.id : null,
    }),

  // Terminal panel
  terminalMachineId: null,
  setTerminalMachineId: (id) => set({ terminalMachineId: id }),

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

  // Profile settings modal
  profileModalOpen: false,
  profileModalTab: 'profile',
  openProfileModal: (tab = 'profile') => set({ profileModalOpen: true, profileModalTab: tab }),
  closeProfileModal: () => set({ profileModalOpen: false }),
  setProfileModalTab: (tab) => set({ profileModalTab: tab }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).substring(7) }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
