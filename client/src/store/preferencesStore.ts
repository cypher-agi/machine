import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences } from '@/features/profile/types';

interface PreferencesState extends UserPreferences {
  // Actions
  setTheme: (theme: UserPreferences['theme']) => void;
  setTimezone: (timezone: UserPreferences['timezone']) => void;
  setRefreshInterval: (interval: number) => void;
  setNotificationPreference: (
    category: 'deployments' | 'machines',
    key: string,
    enabled: boolean
  ) => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  timezone: 'local',
  refreshInterval: 10,
  notifications: {
    deployments: { started: true, succeeded: true, failed: true },
    machines: { unreachable: true, serviceFailed: true, driftDetected: true },
  },
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,

      setTheme: (theme) => set({ theme }),
      setTimezone: (timezone) => set({ timezone }),
      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
      setNotificationPreference: (category, key, enabled) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [category]: {
              ...state.notifications[category],
              [key]: enabled,
            },
          },
        })),
    }),
    {
      name: 'user-preferences',
    }
  )
);
