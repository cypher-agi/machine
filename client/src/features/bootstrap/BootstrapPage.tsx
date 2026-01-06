import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  RefreshCw, 
  Package,
  Trash2,
  Edit,
  Lock,
  Cloud,
  Terminal,
  Play,
  X,
  Code,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { getBootstrapProfiles, deleteBootstrapProfile, createBootstrapProfile, updateBootstrapProfile } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import type { BootstrapMethod, BootstrapProfile, BootstrapProfileCreateRequest } from '@machine/shared';

const methodIcons: Record<BootstrapMethod, typeof Cloud> = {
  cloud_init: Cloud,
  ssh_script: Terminal,
  ansible: Play,
};

const methodLabels: Record<BootstrapMethod, string> = {
  cloud_init: 'Cloud-Init',
  ssh_script: 'SSH Script',
  ansible: 'Ansible',
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: BootstrapProfile;
}

function ProfileModal({ isOpen, onClose, profile }: ProfileModalProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const isEditing = !!profile;

  const [formData, setFormData] = useState<BootstrapProfileCreateRequest>({
    name: profile?.name || '',
    description: profile?.description || '',
    method: profile?.method || 'cloud_init',
    cloud_init_template: profile?.cloud_init_template || `#cloud-config
package_update: true
packages:
  - curl
  - git

runcmd:
  - echo "Bootstrap complete"`,
    ssh_bootstrap_script: profile?.ssh_bootstrap_script || `#!/bin/bash
set -e
echo "Bootstrap starting..."
# Add your commands here
echo "Bootstrap complete"`,
    ansible_playbook_ref: profile?.ansible_playbook_ref || '',
    services_to_run: profile?.services_to_run || [],
    tags: profile?.tags || [],
  });

  const createMutation = useMutation({
    mutationFn: createBootstrapProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bootstrap-profiles'] });
      addToast({ type: 'success', title: 'Profile created successfully' });
      onClose();
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to create profile', message: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: BootstrapProfileCreateRequest) => updateBootstrapProfile(profile!.profile_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bootstrap-profiles'] });
      addToast({ type: 'success', title: 'Profile updated successfully' });
      onClose();
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to update profile', message: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!isOpen) return null;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-machine-surface border border-machine-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-machine-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEditing ? 'Edit Bootstrap Profile' : 'Create Bootstrap Profile'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Profile Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full"
              placeholder="My Bootstrap Profile"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              placeholder="What this profile does..."
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Bootstrap Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['cloud_init', 'ssh_script', 'ansible'] as BootstrapMethod[]).map((method) => {
                const Icon = methodIcons[method];
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setFormData({ ...formData, method })}
                    className={clsx(
                      'p-3 rounded-lg border text-left transition-all',
                      formData.method === method
                        ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                        : 'border-machine-border bg-machine-elevated hover:border-text-tertiary text-text-secondary'
                    )}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <div className="text-sm font-medium">{methodLabels[method]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template based on method */}
          {formData.method === 'cloud_init' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                <Code className="w-4 h-4 inline mr-1" />
                Cloud-Init Template (YAML)
              </label>
              <textarea
                value={formData.cloud_init_template}
                onChange={(e) => setFormData({ ...formData, cloud_init_template: e.target.value })}
                className="input w-full font-mono text-sm"
                rows={16}
                placeholder="#cloud-config"
                spellCheck={false}
              />
              <p className="text-xs text-text-tertiary mt-1">
                Cloud-init config that runs on first boot. Use YAML format starting with #cloud-config
              </p>
            </div>
          )}

          {formData.method === 'ssh_script' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                <Terminal className="w-4 h-4 inline mr-1" />
                SSH Bootstrap Script (Bash)
              </label>
              <textarea
                value={formData.ssh_bootstrap_script}
                onChange={(e) => setFormData({ ...formData, ssh_bootstrap_script: e.target.value })}
                className="input w-full font-mono text-sm"
                rows={16}
                placeholder="#!/bin/bash"
                spellCheck={false}
              />
              <p className="text-xs text-text-tertiary mt-1">
                Bash script that runs after SSH connection is established
              </p>
            </div>
          )}

          {formData.method === 'ansible' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Ansible Playbook Reference
              </label>
              <input
                type="text"
                value={formData.ansible_playbook_ref}
                onChange={(e) => setFormData({ ...formData, ansible_playbook_ref: e.target.value })}
                className="input w-full font-mono"
                placeholder="git@github.com:org/playbooks.git#main:site.yml"
              />
              <p className="text-xs text-text-tertiary mt-1">
                Git reference to Ansible playbook in format: repo#branch:path
              </p>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags?.join(', ') || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
              })}
              className="input w-full"
              placeholder="production, web, docker"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-machine-border">
          <button type="button" onClick={onClose} className="btn btn-ghost" disabled={isPending}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={isPending || !formData.name}
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {isEditing ? 'Update Profile' : 'Create Profile'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BootstrapPage() {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BootstrapProfile | undefined>();
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const { data: profiles, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['bootstrap-profiles'],
    queryFn: getBootstrapProfiles,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBootstrapProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bootstrap-profiles'] });
      addToast({ type: 'success', title: 'Profile deleted' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
    },
  });

  const openCreateModal = () => {
    setEditingProfile(undefined);
    setModalOpen(true);
  };

  const openEditModal = (profile: BootstrapProfile) => {
    setEditingProfile(profile);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProfile(undefined);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Modal */}
      <ProfileModal isOpen={modalOpen} onClose={closeModal} profile={editingProfile} />

      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-machine-border bg-black px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-text-primary">Bootstrap Profiles</h1>
          <span className="text-sm text-text-tertiary font-mono">
            {profiles?.length ?? 0} profiles
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn btn-ghost btn-icon"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <span className="text-text-secondary animate-pulse">Loading profiles...</span>
              <p className="text-text-secondary">Loading profiles...</p>
            </div>
          </div>
        ) : profiles && profiles.length > 0 ? (
          <div className="grid gap-4">
            {profiles.map((profile, index) => {
              const MethodIcon = methodIcons[profile.method];

              return (
                <div 
                  key={profile.profile_id}
                  className="card animate-slide-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-machine-elevated border border-machine-border flex items-center justify-center">
                      <MethodIcon className="w-6 h-6 text-neon-cyan" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-text-primary">{profile.name}</h3>
                        {profile.is_system_profile && (
                          <span className="flex items-center gap-1 text-xs bg-neon-cyan/10 text-neon-cyan px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3" />
                            System
                          </span>
                        )}
                        <span className="text-xs text-text-tertiary bg-machine-elevated px-2 py-0.5 rounded">
                          {methodLabels[profile.method]}
                        </span>
                      </div>

                      <p className="text-sm text-text-secondary mb-3">
                        {profile.description || 'No description'}
                      </p>

                      {/* Services */}
                      {profile.services_to_run.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-text-tertiary">Services:</span>
                          <div className="flex flex-wrap gap-1">
                            {profile.services_to_run.map((svc) => (
                              <span
                                key={svc.service_name}
                                className="text-xs font-mono bg-status-running/10 text-status-running px-2 py-0.5 rounded"
                              >
                                {svc.display_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {profile.tags && profile.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-tertiary">Tags:</span>
                          <div className="flex flex-wrap gap-1">
                            {profile.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-machine-elevated text-text-secondary px-1.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-tertiary">
                        {formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true })}
                      </span>
                      {!profile.is_system_profile && (
                        <>
                          <button 
                            onClick={() => openEditModal(profile)}
                            className="btn btn-ghost btn-icon"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete profile "${profile.name}"?`)) {
                                deleteMutation.mutate(profile.profile_id);
                              }
                            }}
                            className="btn btn-ghost btn-icon text-text-tertiary hover:text-neon-red"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Config variables */}
                  {profile.config_schema && profile.config_schema.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-machine-border">
                      <p className="text-xs text-text-tertiary mb-2">Configuration Variables:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {profile.config_schema.map((variable) => (
                          <div
                            key={variable.name}
                            className="text-xs bg-machine-elevated px-2 py-1.5 rounded"
                          >
                            <code className="text-neon-cyan">{variable.name}</code>
                            <span className="text-text-tertiary ml-1">({variable.type})</span>
                            {variable.required && (
                              <span className="text-neon-red ml-1">*</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View Template Button */}
                  {profile.cloud_init_template && (
                    <div className="mt-4 pt-4 border-t border-machine-border">
                      <button
                        onClick={() => setExpandedProfile(expandedProfile === profile.profile_id ? null : profile.profile_id)}
                        className="flex items-center gap-2 text-sm text-text-secondary hover:text-neon-cyan transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Template
                        {expandedProfile === profile.profile_id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      
                      {expandedProfile === profile.profile_id && (
                        <div className="mt-3">
                          <pre className="bg-machine-bg border border-machine-border rounded-lg p-4 text-xs font-mono text-text-secondary overflow-x-auto max-h-96 overflow-y-auto">
                            {profile.cloud_init_template}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-machine-elevated border border-machine-border flex items-center justify-center">
                <Package className="w-8 h-8 text-text-tertiary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary mb-1">No bootstrap profiles</h3>
                <p className="text-text-secondary mb-4">
                  Create a profile to define what gets installed on your machines at boot.
                </p>
                <button className="btn btn-primary">
                  <Plus className="w-4 h-4" />
                  New Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BootstrapPage;
