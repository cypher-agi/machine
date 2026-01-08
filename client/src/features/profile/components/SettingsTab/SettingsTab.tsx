import { Moon, Sun, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useAppStore } from '@/store/appStore';
import { Select, Toggle } from '@/shared/ui';
import styles from './SettingsTab.module.css';

export function SettingsTab() {
  const preferences = usePreferencesStore();
  const { addToast } = useAppStore();

  const handleThemeChange = (theme: 'dark' | 'light' | 'system') => {
    preferences.setTheme(theme);
    addToast({ type: 'success', title: `Theme set to ${theme}` });
  };

  return (
    <div className={styles.tab}>
      {/* Appearance */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Appearance</h3>

        <div className={styles.formRow}>
          <div className={styles.formRowLabel}>
            <p className={styles.formLabel}>Theme</p>
            <p className={styles.formLabelDesc}>Choose your preferred color scheme</p>
          </div>
          <div className={styles.themeToggle}>
            <button
              className={clsx(
                styles.themeButton,
                preferences.theme === 'dark' && styles.themeButtonActive
              )}
              onClick={() => handleThemeChange('dark')}
              title="Dark"
            >
              <Moon size={14} />
            </button>
            <button
              className={clsx(
                styles.themeButton,
                preferences.theme === 'light' && styles.themeButtonActive
              )}
              onClick={() => handleThemeChange('light')}
              title="Light"
            >
              <Sun size={14} />
            </button>
            <button
              className={clsx(
                styles.themeButton,
                preferences.theme === 'system' && styles.themeButtonActive
              )}
              onClick={() => handleThemeChange('system')}
              title="System"
            >
              <Monitor size={14} />
            </button>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formRowLabel}>
            <p className={styles.formLabel}>Refresh Interval</p>
            <p className={styles.formLabelDesc}>How often to poll for updates</p>
          </div>
          <Select
            size="sm"
            value={preferences.refreshInterval.toString()}
            onChange={(e) => preferences.setRefreshInterval(Number(e.target.value))}
            className={styles.selectNarrow}
          >
            <option value="5">5 seconds</option>
            <option value="10">10 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
          </Select>
        </div>
      </div>

      {/* Date & Time */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Date & Time</h3>

        <div className={styles.formRow}>
          <div className={styles.formRowLabel}>
            <p className={styles.formLabel}>Timezone</p>
            <p className={styles.formLabelDesc}>How to display timestamps</p>
          </div>
          <Select
            size="sm"
            value={preferences.timezone}
            onChange={(e) => preferences.setTimezone(e.target.value as 'local' | 'utc')}
            className={styles.selectMedium}
          >
            <option value="local">Local timezone</option>
            <option value="utc">UTC</option>
          </Select>
        </div>
      </div>

      {/* Deployment Notifications */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Deployment Notifications</h3>

        {(['started', 'succeeded', 'failed'] as const).map((key) => (
          <div key={key} className={styles.toggleRow}>
            <span className={styles.toggleLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            <Toggle
              checked={preferences.notifications.deployments[key]}
              onChange={(e) =>
                preferences.setNotificationPreference('deployments', key, e.target.checked)
              }
            />
          </div>
        ))}
      </div>

      {/* Machine Alerts */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Machine Alerts</h3>

        {[
          { key: 'unreachable' as const, label: 'Unreachable' },
          { key: 'serviceFailed' as const, label: 'Service failed' },
          { key: 'driftDetected' as const, label: 'Drift detected' },
        ].map(({ key, label }) => (
          <div key={key} className={styles.toggleRow}>
            <span className={styles.toggleLabel}>{label}</span>
            <Toggle
              checked={preferences.notifications.machines[key]}
              onChange={(e) =>
                preferences.setNotificationPreference('machines', key, e.target.checked)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
