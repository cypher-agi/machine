import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, TeamWithMembership } from '@machina/shared';
import * as authApi from '@/lib/authApi';
import * as api from '@/lib/api';
import { setTeamIdGetter } from '@/lib/api';
import { clearQueryCache } from '@/lib/queryClient';

interface AuthState {
  // State
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresSetup: boolean;
  devMode: boolean;

  // Team state
  currentTeamId: string | null;
  teams: TeamWithMembership[];
  teamsLoading: boolean;

  // Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  devLogin: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  updateProfile: (data: { display_name?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAvatar: () => Promise<void>;
  clearAuth: () => void;

  // Team actions
  loadTeams: () => Promise<void>;
  setCurrentTeam: (teamId: string) => void;
  getCurrentTeam: () => TeamWithMembership | undefined;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      isLoading: true,
      requiresSetup: false,
      devMode: false,

      // Team state
      currentTeamId: null,
      teams: [],
      teamsLoading: false,

      // Check auth status (has users, dev mode, etc)
      checkAuthStatus: async () => {
        try {
          const status = await authApi.getAuthStatus();
          set({
            requiresSetup: status.requires_setup,
            devMode: status.dev_mode,
          });

          // If we have a session token, try to validate it
          const { sessionToken, loadTeams } = get();
          if (sessionToken) {
            try {
              const user = await authApi.getMe();
              set({ user, isAuthenticated: true });
              // Load teams before setting isLoading to false
              // This ensures team context is available before any API calls
              await loadTeams();
              set({ isLoading: false });
            } catch {
              // Token is invalid, clear auth and cache
              clearQueryCache();
              set({
                user: null,
                sessionToken: null,
                isAuthenticated: false,
                isLoading: false,
                currentTeamId: null,
                teams: [],
              });
            }
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Failed to check auth status:', error);
          set({ isLoading: false });
        }
      },

      // Login with email/password
      login: async (email, password, rememberMe = false) => {
        // Clear any previous session data first
        clearQueryCache();

        const response = await authApi.login({
          email,
          password,
          remember_me: rememberMe,
        });

        set({
          user: response.user,
          sessionToken: response.session_token,
          isAuthenticated: true,
          // Reset team state - will be loaded fresh
          currentTeamId: null,
          teams: [],
        });

        // Load teams after login
        await get().loadTeams();
      },

      // Dev login (quick access in development)
      devLogin: async () => {
        // Clear any previous session data first
        clearQueryCache();

        const response = await authApi.devLogin();

        set({
          user: response.user,
          sessionToken: response.session_token,
          isAuthenticated: true,
          // Reset team state - will be loaded fresh
          currentTeamId: null,
          teams: [],
        });

        // Load teams after login
        await get().loadTeams();
      },

      // Register new user
      register: async (email, password, displayName) => {
        // Clear any previous session data first
        clearQueryCache();

        const response = await authApi.register({
          email,
          password,
          display_name: displayName,
        });

        set({
          user: response.user,
          sessionToken: response.session_token,
          isAuthenticated: true,
          requiresSetup: false,
          // Reset team state - will be loaded fresh
          currentTeamId: null,
          teams: [],
        });

        // Load teams after registration (default team is created)
        await get().loadTeams();
      },

      // Logout current session
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore errors - we're logging out anyway
        }

        // Clear all cached data
        clearQueryCache();

        set({
          user: null,
          sessionToken: null,
          isAuthenticated: false,
          currentTeamId: null,
          teams: [],
        });
      },

      // Logout all sessions
      logoutAll: async () => {
        try {
          await authApi.logoutAll();
        } catch {
          // Ignore errors
        }

        // Clear all cached data
        clearQueryCache();

        set({
          user: null,
          sessionToken: null,
          isAuthenticated: false,
          currentTeamId: null,
          teams: [],
        });
      },

      // Refresh user data
      refreshUser: async () => {
        const user = await authApi.getMe();
        set({ user });
      },

      // Update profile
      updateProfile: async (data) => {
        const user = await authApi.updateMe(data);
        set({ user });
      },

      // Change password
      changePassword: async (currentPassword, newPassword) => {
        await authApi.updateMe({
          current_password: currentPassword,
          new_password: newPassword,
        });
      },

      // Upload avatar
      uploadAvatar: async (file) => {
        const user = await authApi.uploadAvatar(file);
        set({ user });
      },

      // Delete avatar
      deleteAvatar: async () => {
        const user = await authApi.deleteAvatar();
        set({ user });
      },

      // Clear auth state (for when session expires)
      clearAuth: () => {
        clearQueryCache();
        set({
          user: null,
          sessionToken: null,
          isAuthenticated: false,
          currentTeamId: null,
          teams: [],
        });
      },

      // Load teams for the current user
      loadTeams: async () => {
        set({ teamsLoading: true });
        try {
          const teams = await api.getTeams();
          const { currentTeamId } = get();

          // If no team is selected, or the selected team is no longer valid,
          // select the first team (user's default personal team)
          let validTeamId = currentTeamId;
          if (!validTeamId || !teams.find((t) => t.team_id === validTeamId)) {
            validTeamId = teams[0]?.team_id || null;
          }

          set({
            teams,
            currentTeamId: validTeamId,
            teamsLoading: false,
          });
        } catch (error) {
          console.error('Failed to load teams:', error);
          set({ teamsLoading: false });
        }
      },

      // Set the current active team
      setCurrentTeam: (teamId: string) => {
        const { teams } = get();
        const team = teams.find((t) => t.team_id === teamId);
        if (team) {
          // Clear cache when switching teams to load fresh data
          clearQueryCache();
          set({ currentTeamId: teamId });
        }
      },

      // Get the current team object
      getCurrentTeam: () => {
        const { teams, currentTeamId } = get();
        return teams.find((t) => t.team_id === currentTeamId);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        currentTeamId: state.currentTeamId,
      }),
    }
  )
);

// Register the team ID getter with the API module
// This allows API calls to read the team ID directly from the store
// instead of from localStorage (avoiding race conditions)
setTeamIdGetter(() => useAuthStore.getState().currentTeamId);
