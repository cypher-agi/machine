import { useState } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Database,
  Key,
  Moon,
  Sun,
  Save,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { Button, Input, Select, Toggle } from '@/shared/ui';
import styles from './SettingsApp.module.css';

type SettingsTab = 'general' | 'security' | 'notifications' | 'terraform';

export function SettingsApp() {
  const { addToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'terraform', label: 'Terraform', icon: Database },
  ];

  const handleSave = () => {
    addToast({ type: 'success', title: 'Settings saved' });
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <div className={styles.body}>
        {/* Tabs sidebar */}
        <nav className={styles.nav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(styles.navButton, activeTab === tab.id && styles.navButtonActive)}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'general' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>General</h2>
                <p className={styles.sectionDesc}>Configure application preferences.</p>
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Appearance</h3>
                <div className={styles.formRow}>
                  <div>
                    <p className={styles.formLabel}>Theme</p>
                    <p className={styles.formLabelDesc}>Color scheme</p>
                  </div>
                  <div className={styles.themeToggle}>
                    <button className={clsx(styles.themeButton, styles.themeButtonActive)}>
                      <Moon size={12} />
                    </button>
                    <button className={styles.themeButton}>
                      <Sun size={12} />
                    </button>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div>
                    <p className={styles.formLabel}>Refresh interval</p>
                    <p className={styles.formLabelDesc}>Polling frequency</p>
                  </div>
                  <Select size="sm" className={styles.selectNarrow}>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                  </Select>
                </div>
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Date & Time</h3>
                <div className={styles.formRow}>
                  <div>
                    <p className={styles.formLabel}>Timezone</p>
                    <p className={styles.formLabelDesc}>Display times</p>
                  </div>
                  <Select size="sm" className={styles.selectMedium}>
                    <option value="local">Local</option>
                    <option value="utc">UTC</option>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Security</h2>
                <p className={styles.sectionDesc}>Manage access controls.</p>
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Session</h3>
                <div className={styles.formRow}>
                  <div>
                    <p className={styles.formLabel}>Timeout</p>
                    <p className={styles.formLabelDesc}>Auto logout after inactivity</p>
                  </div>
                  <Select size="sm" className={styles.selectNarrow}>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="480">8 hours</option>
                  </Select>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitleNoMargin}>API Keys</h3>
                  <Button variant="secondary" size="sm">
                    <Key size={12} />
                    Generate
                  </Button>
                </div>
                <p className={styles.emptyText}>No API keys configured.</p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Notifications</h2>
                <p className={styles.sectionDesc}>Configure alerts and updates.</p>
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Deployments</h3>
                {['Started', 'Succeeded', 'Failed'].map((label) => (
                  <div key={label} className={styles.formRow}>
                    <span className={styles.toggleLabel}>{label}</span>
                    <Toggle defaultChecked />
                  </div>
                ))}
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Machine Alerts</h3>
                {['Unreachable', 'Service failed', 'Drift detected'].map((label) => (
                  <div key={label} className={styles.formRow}>
                    <span className={styles.toggleLabel}>{label}</span>
                    <Toggle defaultChecked />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'terraform' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Terraform</h2>
                <p className={styles.sectionDesc}>Configure execution and state.</p>
              </div>

              <div className={styles.warningBox}>
                <AlertTriangle size={14} className={styles.warningIcon} />
                <p className={styles.warningText}>
                  Changes affect all deployments. Proceed with caution.
                </p>
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>State Backend</h3>
                <div className={styles.formField}>
                  <label className={styles.formFieldLabel}>Backend Type</label>
                  <Select size="sm">
                    <option value="local">Local</option>
                    <option value="s3">AWS S3</option>
                    <option value="gcs">Google Cloud Storage</option>
                    <option value="remote">Terraform Cloud</option>
                  </Select>
                </div>
                <div>
                  <label className={styles.formFieldLabel}>State Bucket</label>
                  <Input type="text" placeholder="my-state-bucket" mono size="sm" />
                </div>
              </div>

              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Execution</h3>
                <div className={styles.formRow}>
                  <span className={styles.toggleLabel}>Auto-approve</span>
                  <Toggle />
                </div>
                <div className={styles.formRow}>
                  <span className={styles.toggleLabel}>Refresh before plan</span>
                  <Toggle defaultChecked />
                </div>
              </div>
            </div>
          )}

          <div className={styles.saveBar}>
            <Button variant="primary" size="sm" onClick={handleSave}>
              <Save size={14} />
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
