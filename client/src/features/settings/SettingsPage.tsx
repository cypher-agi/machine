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
  AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';

type SettingsTab = 'general' | 'security' | 'notifications' | 'terraform';

function SettingsPage() {
  const { addToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'terraform', label: 'Terraform', icon: Database },
  ];

  const handleSave = () => {
    addToast({ type: 'success', title: 'Settings saved', message: 'Your changes have been saved.' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-machine-border bg-black px-6 flex items-center">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Tabs sidebar */}
        <nav className="w-56 border-r border-machine-border p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                activeTab === tab.id
                  ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-machine-elevated border border-transparent'
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'general' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">General Settings</h2>
                <p className="text-sm text-text-secondary">Configure general application preferences.</p>
              </div>

              {/* Theme */}
              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">Appearance</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">Theme</p>
                      <p className="text-xs text-text-tertiary">Select your preferred color scheme</p>
                    </div>
                    <div className="flex items-center gap-2 bg-machine-elevated rounded-lg p-1">
                      <button className="p-2 rounded bg-machine-surface text-neon-cyan">
                        <Moon className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded text-text-tertiary hover:text-text-secondary">
                        <Sun className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">Refresh interval</p>
                      <p className="text-xs text-text-tertiary">How often to poll for updates</p>
                    </div>
                    <select className="input w-32">
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Time/Locale */}
              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">Date & Time</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">Timezone</p>
                      <p className="text-xs text-text-tertiary">Display times in this timezone</p>
                    </div>
                    <select className="input w-48">
                      <option value="local">Local (Browser)</option>
                      <option value="utc">UTC</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Security Settings</h2>
                <p className="text-sm text-text-secondary">Manage security and access controls.</p>
              </div>

              {/* Session */}
              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">Session</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">Session timeout</p>
                      <p className="text-xs text-text-tertiary">Automatically log out after inactivity</p>
                    </div>
                    <select className="input w-32">
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="480">8 hours</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* API Keys */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-text-primary">API Keys</h3>
                  <button className="btn btn-secondary btn-sm">
                    <Key className="w-4 h-4" />
                    Generate Key
                  </button>
                </div>
                <div className="text-sm text-text-secondary bg-machine-elevated rounded-lg p-4 text-center">
                  No API keys configured. Generate a key to access the API programmatically.
                </div>
              </div>

              {/* Audit */}
              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">Audit Log</h3>
                <p className="text-sm text-text-secondary mb-4">
                  All actions are logged for security and compliance purposes.
                </p>
                <button className="btn btn-secondary btn-sm">
                  View Audit Log
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Notification Settings</h2>
                <p className="text-sm text-text-secondary">Configure how you receive alerts and updates.</p>
              </div>

              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">Deployment Notifications</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Deployment started', description: 'When a Terraform apply begins' },
                    { label: 'Deployment succeeded', description: 'When a deployment completes successfully' },
                    { label: 'Deployment failed', description: 'When a deployment encounters an error' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-text-primary">{item.label}</p>
                        <p className="text-xs text-text-tertiary">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-machine-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">Machine Alerts</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Machine unreachable', description: 'When a machine fails health checks' },
                    { label: 'Service failed', description: 'When a monitored service goes down' },
                    { label: 'Terraform drift detected', description: 'When state differs from reality' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-text-primary">{item.label}</p>
                        <p className="text-xs text-text-tertiary">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-machine-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terraform' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Terraform Settings</h2>
                <p className="text-sm text-text-secondary">Configure Terraform execution and state management.</p>
              </div>

              <div className="bg-status-warning/5 border border-status-warning/20 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-status-warning font-medium">Advanced Configuration</p>
                  <p className="text-sm text-text-secondary mt-1">
                    Changes to Terraform settings can affect all deployments. Proceed with caution.
                  </p>
                </div>
              </div>

              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">State Backend</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-primary mb-2">Backend Type</label>
                    <select className="input">
                      <option value="local">Local (Development only)</option>
                      <option value="s3">AWS S3</option>
                      <option value="gcs">Google Cloud Storage</option>
                      <option value="azurerm">Azure Blob Storage</option>
                      <option value="remote">Terraform Cloud</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-text-primary mb-2">State Bucket</label>
                    <input
                      type="text"
                      placeholder="my-terraform-state-bucket"
                      className="input font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-text-primary mb-2">Lock Table (DynamoDB)</label>
                    <input
                      type="text"
                      placeholder="terraform-state-lock"
                      className="input font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-medium text-text-primary mb-4">Execution</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">Auto-approve applies</p>
                      <p className="text-xs text-text-tertiary">Skip manual approval for non-destructive changes</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-machine-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">Parallel execution</p>
                      <p className="text-xs text-text-tertiary">Number of concurrent Terraform operations</p>
                    </div>
                    <select className="input w-24">
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="4">4</option>
                      <option value="8">8</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-primary">Refresh before plan</p>
                      <p className="text-xs text-text-tertiary">Always refresh state before planning</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-machine-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="max-w-2xl mt-8 flex justify-end">
            <button onClick={handleSave} className="btn btn-primary">
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;

