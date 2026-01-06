import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  Cloud,
  Server,
  Shield,
  Package,
  FileText,
  Loader2,
  Key,
  Fingerprint
} from 'lucide-react';
import clsx from 'clsx';
import { 
  getProviderAccounts, 
  getProviderOptions, 
  getBootstrapProfiles,
  getFirewallProfiles,
  getSSHKeys,
  createMachine 
} from '@/lib/api';
import type { MachineCreateRequest } from '@machine/shared';
import { useAppStore } from '@/store/appStore';

interface DeployWizardProps {
  onClose: () => void;
}

type WizardStep = 'provider' | 'config' | 'firewall' | 'bootstrap' | 'access' | 'review';

const steps: { id: WizardStep; label: string; icon: typeof Cloud }[] = [
  { id: 'provider', label: 'Provider', icon: Cloud },
  { id: 'config', label: 'Configuration', icon: Server },
  { id: 'firewall', label: 'Firewall', icon: Shield },
  { id: 'bootstrap', label: 'Bootstrap', icon: Package },
  { id: 'access', label: 'Access', icon: Key },
  { id: 'review', label: 'Review', icon: FileText },
];

export function DeployWizard({ onClose }: DeployWizardProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  
  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('provider');
  const [maxVisitedStep, setMaxVisitedStep] = useState(0); // Track furthest step reached
  const [formData, setFormData] = useState<Partial<MachineCreateRequest>>({
    tags: {},
    firewall_profile_id: 'none',
    bootstrap_profile_id: 'none',
  });

  const { data: providerAccounts } = useQuery({
    queryKey: ['provider-accounts'],
    queryFn: getProviderAccounts,
  });

  const selectedAccount = providerAccounts?.find(
    (a) => a.provider_account_id === formData.provider_account_id
  );

  const { data: providerOptions } = useQuery({
    queryKey: ['provider-options', selectedAccount?.provider_type],
    queryFn: () => getProviderOptions(selectedAccount!.provider_type),
    enabled: !!selectedAccount,
  });

  // Set defaults when provider options load
  useEffect(() => {
    if (providerOptions) {
      const updates: Partial<MachineCreateRequest> = {};
      
      // Default region to San Francisco for DigitalOcean
      if (!formData.region) {
        const sfRegion = providerOptions.regions.find(r => r.slug === 'sfo3' || r.slug.startsWith('sfo'));
        if (sfRegion) {
          updates.region = sfRegion.slug;
        } else if (providerOptions.regions.length > 0) {
          updates.region = providerOptions.regions[0].slug;
        }
      }
      
      // Default size to first (cheapest) option
      if (!formData.size && providerOptions.sizes.length > 0) {
        updates.size = providerOptions.sizes[0].slug;
      }
      
      // Default to Ubuntu 22.04 x64 for DigitalOcean
      if (!formData.image) {
        const defaultImage = providerOptions.images.find(img => img.slug === 'ubuntu-22-04-x64');
        if (defaultImage) {
          updates.image = defaultImage.slug;
        } else if (providerOptions.images.length > 0) {
          updates.image = providerOptions.images[0].slug;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
      }
    }
  }, [providerOptions, formData.region, formData.size, formData.image]);

  const { data: bootstrapProfiles } = useQuery({
    queryKey: ['bootstrap-profiles'],
    queryFn: getBootstrapProfiles,
  });

  const { data: firewallProfiles } = useQuery({
    queryKey: ['firewall-profiles'],
    queryFn: getFirewallProfiles,
  });

  const { data: sshKeys } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: getSSHKeys,
  });

  // Filter SSH keys that are synced to the selected provider
  const availableSSHKeys = sshKeys?.filter(key => {
    if (!selectedAccount) return false;
    return key.provider_key_ids[selectedAccount.provider_type];
  }) || [];

  const createMutation = useMutation({
    mutationFn: createMachine,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      addToast({ 
        type: 'success', 
        title: 'Machine created', 
        message: `Deploying ${data.machine.name}` 
      });
      onClose();
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to create machine', message: error.message });
    },
  });

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const canGoNext = () => {
    switch (currentStep) {
      case 'provider':
        return !!formData.provider_account_id;
      case 'config':
        return !!formData.name && !!formData.region && !!formData.size && !!formData.image;
      case 'firewall':
        return formData.firewall_profile_id !== undefined; // Must select (including 'none')
      case 'bootstrap':
        return formData.bootstrap_profile_id !== undefined; // Must select (including 'none')
      case 'access':
        return true; // Always can proceed - none is default
      case 'review':
        return true;
      default:
        return false;
    }
  };

  // Toggle SSH key selection
  const toggleSSHKey = (keyId: string) => {
    const currentKeys = formData.ssh_key_ids || [];
    if (currentKeys.includes(keyId)) {
      setFormData({ ...formData, ssh_key_ids: currentKeys.filter(id => id !== keyId) });
    } else {
      setFormData({ ...formData, ssh_key_ids: [...currentKeys, keyId] });
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
      setMaxVisitedStep(Math.max(maxVisitedStep, nextIndex));
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.provider_account_id || !formData.region || !formData.size || !formData.image) {
      return;
    }
    // Convert 'none' selections to undefined before submitting
    const submitData: MachineCreateRequest = {
      ...formData as MachineCreateRequest,
      firewall_profile_id: formData.firewall_profile_id === 'none' ? undefined : formData.firewall_profile_id,
      bootstrap_profile_id: formData.bootstrap_profile_id === 'none' ? undefined : formData.bootstrap_profile_id,
      ssh_key_ids: formData.ssh_key_ids && formData.ssh_key_ids.length > 0 ? formData.ssh_key_ids : undefined,
    };
    createMutation.mutate(submitData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col animate-slide-in-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-machine-border">
          <h2 className="font-semibold text-lg text-text-primary">Deploy New Machine</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-4 py-3 border-b border-machine-border">
          <div className="flex items-center justify-center gap-1">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isVisited = index <= maxVisitedStep;
              const isPast = index < currentStepIndex;
              const canClick = isVisited && !isActive;
              const StepIcon = step.icon;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => canClick && setCurrentStep(step.id)}
                    disabled={!canClick && !isActive}
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors text-sm',
                      isActive && 'bg-neon-cyan/10 text-neon-cyan',
                      canClick && 'text-status-running cursor-pointer hover:bg-machine-elevated',
                      !isActive && !canClick && 'text-text-tertiary cursor-not-allowed'
                    )}
                  >
                    {isPast ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                    <span className="font-medium hidden sm:inline">{step.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className={clsx(
                      'w-4 h-px mx-1',
                      isPast ? 'bg-status-running' : 'bg-machine-border'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Provider Step */}
          {currentStep === 'provider' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">Select Provider Account</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Choose the cloud provider account to deploy to.
                </p>
              </div>
              <div className="grid gap-3">
                {providerAccounts?.map((account) => (
                  <button
                    key={account.provider_account_id}
                    onClick={() => setFormData({ ...formData, provider_account_id: account.provider_account_id })}
                    className={clsx(
                      'card text-left transition-all',
                      formData.provider_account_id === account.provider_account_id
                        ? 'border-neon-cyan bg-neon-cyan/5'
                        : 'hover:border-machine-border-light'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-machine-elevated flex items-center justify-center text-xl">
                        {account.provider_type === 'digitalocean' && '🌊'}
                        {account.provider_type === 'aws' && '☁️'}
                        {account.provider_type === 'gcp' && '🔷'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-text-primary">{account.label}</p>
                        <p className="text-sm text-text-secondary capitalize">{account.provider_type}</p>
                      </div>
                      <span className={clsx(
                        'text-xs font-medium px-2 py-1 rounded',
                        account.credential_status === 'valid' ? 'bg-status-running/10 text-status-running' : 'bg-status-warning/10 text-status-warning'
                      )}>
                        {account.credential_status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Config Step */}
          {currentStep === 'config' && providerOptions && (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Machine Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., grid-node-prod-01"
                  className="input"
                  autoFocus
                />
              </div>

              {/* Region */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Region
                </label>
                <select
                  value={formData.region || ''}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="input"
                >
                  <option value="">Select region...</option>
                  {providerOptions.regions.map((r) => (
                    <option key={r.slug} value={r.slug} disabled={!r.available}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              {/* Size */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Size
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-auto">
                  {providerOptions.sizes.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => setFormData({ ...formData, size: s.slug })}
                      disabled={!s.available}
                      className={clsx(
                        'card text-left p-3 transition-all',
                        formData.size === s.slug
                          ? 'border-neon-cyan bg-neon-cyan/5'
                          : 'hover:border-machine-border-light',
                        !s.available && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <p className="font-mono text-sm text-text-primary">{s.slug}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        {s.vcpus} vCPU • {s.memory_mb / 1024}GB RAM • {s.disk_gb}GB
                      </p>
                      {s.price_monthly && (
                        <p className="text-xs text-neon-cyan mt-1">${s.price_monthly}/mo</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Image / OS
                </label>
                <select
                  value={formData.image || ''}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="input"
                >
                  <option value="">Select image...</option>
                  {providerOptions.images.map((img) => (
                    <option key={img.slug} value={img.slug} disabled={!img.available}>
                      {img.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Firewall Step */}
          {currentStep === 'firewall' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">Firewall Profile</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Select a firewall profile to configure security rules.
                </p>
              </div>
              <div className="grid gap-3">
                {/* None option */}
                <button
                  onClick={() => setFormData({ ...formData, firewall_profile_id: 'none' })}
                  className={clsx(
                    'card text-left transition-all',
                    formData.firewall_profile_id === 'none'
                      ? 'border-neon-cyan bg-neon-cyan/5'
                      : 'hover:border-machine-border-light'
                  )}
                >
                  <p className="font-medium text-text-primary">None</p>
                  <p className="text-sm text-text-secondary">No firewall profile - use provider defaults</p>
                </button>
                
                {firewallProfiles?.map((profile) => (
                  <button
                    key={profile.profile_id}
                    onClick={() => setFormData({ ...formData, firewall_profile_id: profile.profile_id })}
                    className={clsx(
                      'card text-left transition-all',
                      formData.firewall_profile_id === profile.profile_id
                        ? 'border-neon-cyan bg-neon-cyan/5'
                        : 'hover:border-machine-border-light'
                    )}
                  >
                    <p className="font-medium text-text-primary">{profile.name}</p>
                    <p className="text-sm text-text-secondary">{profile.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {profile.rules.slice(0, 5).map((rule) => (
                        <span key={rule.rule_id} className="text-xs font-mono bg-machine-elevated px-1.5 py-0.5 rounded">
                          {rule.protocol}/{rule.port_range_start}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bootstrap Step */}
          {currentStep === 'bootstrap' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">Bootstrap Profile</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Select services and software to install at boot.
                </p>
              </div>
              <div className="grid gap-3">
                {/* None option */}
                <button
                  onClick={() => setFormData({ ...formData, bootstrap_profile_id: 'none' })}
                  className={clsx(
                    'card text-left transition-all',
                    formData.bootstrap_profile_id === 'none'
                      ? 'border-neon-cyan bg-neon-cyan/5'
                      : 'hover:border-machine-border-light'
                  )}
                >
                  <p className="font-medium text-text-primary">None</p>
                  <p className="text-sm text-text-secondary">No bootstrap - vanilla OS installation</p>
                </button>
                
                {bootstrapProfiles?.map((profile) => (
                  <button
                    key={profile.profile_id}
                    onClick={() => setFormData({ ...formData, bootstrap_profile_id: profile.profile_id })}
                    className={clsx(
                      'card text-left transition-all',
                      formData.bootstrap_profile_id === profile.profile_id
                        ? 'border-neon-cyan bg-neon-cyan/5'
                        : 'hover:border-machine-border-light'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-text-primary">{profile.name}</p>
                        <p className="text-sm text-text-secondary">{profile.description}</p>
                      </div>
                      {profile.is_system_profile && (
                        <span className="text-xs bg-neon-cyan/10 text-neon-cyan px-2 py-0.5 rounded">
                          System
                        </span>
                      )}
                    </div>
                    {profile.services_to_run.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {profile.services_to_run.map((svc) => (
                          <span key={svc.service_name} className="text-xs font-mono bg-machine-elevated px-1.5 py-0.5 rounded">
                            {svc.display_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Access Step */}
          {currentStep === 'access' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">SSH Access</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Select SSH keys to grant root access to this machine. You can select multiple keys.
                </p>
              </div>
              
              <div className="grid gap-3">
                {/* None option - shown when no keys selected */}
                <div
                  className={clsx(
                    'card text-left transition-all',
                    (!formData.ssh_key_ids || formData.ssh_key_ids.length === 0)
                      ? 'border-neon-cyan bg-neon-cyan/5'
                      : 'border-machine-border'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-machine-elevated flex items-center justify-center">
                      <Key className="w-5 h-5 text-text-tertiary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-text-primary">None</p>
                      <p className="text-sm text-text-secondary">No SSH key - use provider default or password auth</p>
                    </div>
                    {(!formData.ssh_key_ids || formData.ssh_key_ids.length === 0) && (
                      <Check className="w-5 h-5 text-neon-cyan" />
                    )}
                  </div>
                </div>

                {/* Available SSH keys */}
                {availableSSHKeys.length > 0 ? (
                  availableSSHKeys.map((key) => {
                    const isSelected = formData.ssh_key_ids?.includes(key.ssh_key_id);
                    return (
                      <button
                        key={key.ssh_key_id}
                        onClick={() => toggleSSHKey(key.ssh_key_id)}
                        className={clsx(
                          'card text-left transition-all',
                          isSelected
                            ? 'border-neon-cyan bg-neon-cyan/5'
                            : 'hover:border-machine-border-light'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            isSelected 
                              ? 'bg-neon-cyan/20 border border-neon-cyan/30'
                              : 'bg-machine-elevated'
                          )}>
                            <Key className={clsx(
                              'w-5 h-5',
                              isSelected ? 'text-neon-cyan' : 'text-text-tertiary'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-text-primary">{key.name}</p>
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                              <span className="font-mono text-xs">{key.key_type.toUpperCase()}</span>
                              <span className="flex items-center gap-1 font-mono text-xs truncate">
                                <Fingerprint className="w-3 h-3" />
                                {key.fingerprint.slice(0, 20)}...
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-neon-cyan flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="card bg-status-warning/5 border-status-warning/20">
                    <p className="text-sm text-text-secondary">
                      No SSH keys synced to {selectedAccount?.provider_type || 'this provider'}. 
                      <br />
                      <span className="text-text-tertiary">
                        Go to Keys → sync a key to {selectedAccount?.provider_type} first.
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Info about SSH keys */}
              <div className="mt-4 p-4 bg-machine-elevated/50 border border-machine-border rounded-lg">
                <p className="text-xs text-text-tertiary">
                  💡 SSH keys must be synced to the provider before they can be used. 
                  You can manage and sync keys in the <span className="text-neon-cyan">Keys</span> section.
                </p>
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">Review Configuration</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Confirm your machine configuration before deploying.
                </p>
              </div>

              <div className="card space-y-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Name</span>
                  <span className="font-mono text-text-primary">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Provider</span>
                  <span className="text-text-primary">{selectedAccount?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Region</span>
                  <span className="font-mono text-text-primary">{formData.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Size</span>
                  <span className="font-mono text-text-primary">{formData.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Image</span>
                  <span className="font-mono text-text-primary truncate max-w-[200px]">{formData.image}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Firewall</span>
                  <span className="text-text-primary">
                    {formData.firewall_profile_id === 'none' 
                      ? 'None' 
                      : firewallProfiles?.find(f => f.profile_id === formData.firewall_profile_id)?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Bootstrap</span>
                  <span className="text-text-primary">
                    {formData.bootstrap_profile_id === 'none'
                      ? 'None'
                      : bootstrapProfiles?.find(b => b.profile_id === formData.bootstrap_profile_id)?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">SSH Access</span>
                  <span className="text-text-primary">
                    {!formData.ssh_key_ids || formData.ssh_key_ids.length === 0
                      ? 'None'
                      : formData.ssh_key_ids.map(id => 
                          sshKeys?.find(k => k.ssh_key_id === id)?.name
                        ).filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
              </div>

              <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg p-4">
                <p className="text-sm text-neon-cyan">
                  ⚡ A Terraform plan will be generated and applied automatically to provision this machine.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-machine-border">
          <button
            onClick={goBack}
            disabled={currentStepIndex === 0}
            className="btn btn-secondary"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="btn btn-primary"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Deploy Machine
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="btn btn-primary"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

