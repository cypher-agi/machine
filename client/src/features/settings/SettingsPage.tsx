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
    addToast({ type: 'success', title: 'Settings saved' });
  };

  return (
    <div className="h-full flex flex-col bg-cursor-bg">
      {/* Header */}
      <header className="flex-shrink-0 h-12 border-b border-cursor-border px-4 flex items-center">
        <h1 className="text-sm font-medium text-text-primary">Settings</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Tabs sidebar */}
        <nav className="w-44 border-r border-cursor-border py-2 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
                activeTab === tab.id
                  ? 'bg-cursor-elevated text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-cursor-surface'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'general' && (
            <div className="max-w-lg space-y-4">
              <div>
                <h2 className="text-sm font-medium text-text-primary mb-0.5">General</h2>
                <p className="text-xs text-text-muted">Configure application preferences.</p>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <h3 className="text-xs font-medium text-text-primary mb-3">Appearance</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-primary">Theme</p>
                      <p className="text-[10px] text-text-muted">Color scheme</p>
                    </div>
                    <div className="flex items-center gap-1 bg-cursor-bg rounded p-0.5">
                      <button className="p-1.5 rounded bg-cursor-elevated text-text-primary">
                        <Moon className="w-3 h-3" />
                      </button>
                      <button className="p-1.5 rounded text-text-muted hover:text-text-secondary">
                        <Sun className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-primary">Refresh interval</p>
                      <p className="text-[10px] text-text-muted">Polling frequency</p>
                    </div>
                    <select className="input w-28 h-7 text-xs">
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <h3 className="text-xs font-medium text-text-primary mb-3">Date & Time</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-primary">Timezone</p>
                    <p className="text-[10px] text-text-muted">Display times</p>
                  </div>
                  <select className="input w-32 h-7 text-xs">
                    <option value="local">Local</option>
                    <option value="utc">UTC</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-lg space-y-4">
              <div>
                <h2 className="text-sm font-medium text-text-primary mb-0.5">Security</h2>
                <p className="text-xs text-text-muted">Manage access controls.</p>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <h3 className="text-xs font-medium text-text-primary mb-3">Session</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-primary">Timeout</p>
                    <p className="text-[10px] text-text-muted">Auto logout after inactivity</p>
                  </div>
                  <select className="input w-28 h-7 text-xs">
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="480">8 hours</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-text-primary">API Keys</h3>
                  <button className="btn btn-secondary btn-sm text-[10px]">
                    <Key className="w-3 h-3" />
                    Generate
                  </button>
                </div>
                <p className="text-xs text-text-muted">No API keys configured.</p>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-lg space-y-4">
              <div>
                <h2 className="text-sm font-medium text-text-primary mb-0.5">Notifications</h2>
                <p className="text-xs text-text-muted">Configure alerts and updates.</p>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <h3 className="text-xs font-medium text-text-primary mb-3">Deployments</h3>
                <div className="space-y-2">
                  {['Started', 'Succeeded', 'Failed'].map((label) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">{label}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-8 h-4 bg-cursor-border rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent-blue peer-checked:after:bg-white"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <h3 className="text-xs font-medium text-text-primary mb-3">Machine Alerts</h3>
                <div className="space-y-2">
                  {['Unreachable', 'Service failed', 'Drift detected'].map((label) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">{label}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-8 h-4 bg-cursor-border rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent-blue peer-checked:after:bg-white"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terraform' && (
            <div className="max-w-lg space-y-4">
              <div>
                <h2 className="text-sm font-medium text-text-primary mb-0.5">Terraform</h2>
                <p className="text-xs text-text-muted">Configure execution and state.</p>
              </div>

              <div className="flex items-start gap-2 p-2 bg-status-warning/5 border border-status-warning/20 rounded-md">
                <AlertTriangle className="w-3.5 h-3.5 text-status-warning flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-text-muted">
                  Changes affect all deployments. Proceed with caution.
                </p>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <h3 className="text-xs font-medium text-text-primary mb-3">State Backend</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-text-muted mb-1 block">Backend Type</label>
                    <select className="input text-xs">
                      <option value="local">Local</option>
                      <option value="s3">AWS S3</option>
                      <option value="gcs">Google Cloud Storage</option>
                      <option value="remote">Terraform Cloud</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-text-muted mb-1 block">State Bucket</label>
                    <input type="text" placeholder="my-state-bucket" className="input font-mono text-xs" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-cursor-surface border border-cursor-border rounded-md">
                <h3 className="text-xs font-medium text-text-primary mb-3">Execution</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Auto-approve</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-8 h-4 bg-cursor-border rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent-blue peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Refresh before plan</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-8 h-4 bg-cursor-border rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent-blue peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="max-w-lg mt-4 flex justify-end">
            <button onClick={handleSave} className="btn btn-primary btn-sm">
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
