// Profile Settings Modal types

export type ProfileSettingsTab = 'profile' | 'account' | 'settings';

export interface ProfileFormData {
  display_name: string;
  email: string;
}

export interface PasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

// User preferences (stored in localStorage via Zustand persist)
export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  timezone: 'local' | 'utc';
  refreshInterval: number; // seconds
  notifications: {
    deployments: {
      started: boolean;
      succeeded: boolean;
      failed: boolean;
    };
    machines: {
      unreachable: boolean;
      serviceFailed: boolean;
      driftDetected: boolean;
    };
  };
}
