import { create } from 'zustand';
import type {
  MachineListFilter,
  MachineListSort,
  AgentListFilter,
  AgentListSort,
} from '@machina/shared';
import type { Toast } from '@/shared';
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
  | 'contributor'
  | 'agent';

export interface SidekickSelection {
  type: SidekickItemType;
  id: string;
}

interface AppState {
  // Selected item for sidekick panel (generic)
  sidekickSelection: SidekickSelection | null;
  setSidekickSelection: (selection: SidekickSelection | null) => void;

  // Terminal panel state (machines)
  terminalMachineId: string | null;
  setTerminalMachineId: (id: string | null) => void;

  // Terminal panel state (agents)
  terminalAgentId: string | null;
  setTerminalAgentId: (id: string | null) => void;

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

  // Agent list filters
  agentFilters: AgentListFilter;
  setAgentFilters: (filters: Partial<AgentListFilter>) => void;
  clearAgentFilters: () => void;

  // Agent list sort
  agentSort: AgentListSort;
  setAgentSort: (sort: AgentListSort) => void;

  // Create agent wizard state
  createAgentWizardOpen: boolean;
  setCreateAgentWizardOpen: (open: boolean) => void;

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

const defaultAgentFilters: AgentListFilter = {};
const defaultAgentSort: AgentListSort = { field: 'created_at', direction: 'desc' };

export const useAppStore = create<AppState>((set) => ({
  // Sidekick selection (generic)
  sidekickSelection: null,
  setSidekickSelection: (selection) =>
    set({
      sidekickSelection: selection,
      // Open terminal when selecting a machine or agent
      terminalMachineId: selection?.type === 'machine' ? selection.id : null,
      terminalAgentId: selection?.type === 'agent' ? selection.id : null,
    }),

  // Terminal panel (machines)
  terminalMachineId: null,
  setTerminalMachineId: (id) => set({ terminalMachineId: id }),

  // Terminal panel (agents)
  terminalAgentId: null,
  setTerminalAgentId: (id) => set({ terminalAgentId: id }),

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

  // Agent filters
  agentFilters: defaultAgentFilters,
  setAgentFilters: (filters) =>
    set((state) => ({
      agentFilters: { ...state.agentFilters, ...filters },
    })),
  clearAgentFilters: () => set({ agentFilters: defaultAgentFilters }),

  // Agent sort
  agentSort: defaultAgentSort,
  setAgentSort: (sort) => set({ agentSort: sort }),

  // Create agent wizard
  createAgentWizardOpen: false,
  setCreateAgentWizardOpen: (open) => set({ createAgentWizardOpen: open }),

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
