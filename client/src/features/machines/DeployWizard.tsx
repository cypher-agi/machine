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
  { id: 'config', label: 'Config', icon: Server },
  { id: 'firewall', label: 'Firewall', icon: Shield },
  { id: 'bootstrap', label: 'Bootstrap', icon: Package },
  { id: 'access', label: 'Access', icon: Key },
  { id: 'review', label: 'Review', icon: FileText },
];

export function DeployWizard({ onClose }: DeployWizardProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('provider');
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
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

  useEffect(() => {
    if (providerOptions) {
      const updates: Partial<MachineCreateRequest> = {};
      
      if (!formData.region) {
        const sfRegion = providerOptions.regions.find(r => r.slug === 'sfo3' || r.slug.startsWith('sfo'));
        if (sfRegion) {
          updates.region = sfRegion.slug;
        } else if (providerOptions.regions.length > 0) {
          updates.region = providerOptions.regions[0].slug;
        }
      }
      
      if (!formData.size && providerOptions.sizes.length > 0) {
        updates.size = providerOptions.sizes[0].slug;
      }
      
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
        return formData.firewall_profile_id !== undefined;
      case 'bootstrap':
        return formData.bootstrap_profile_id !== undefined;
      case 'access':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

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
    const submitData: MachineCreateRequest = {
      ...formData as MachineCreateRequest,
      firewall_profile_id: formData.firewall_profile_id === 'none' ? undefined : formData.firewall_profile_id,
      bootstrap_profile_id: formData.bootstrap_profile_id === 'none' ? undefined : formData.bootstrap_profile_id,
      ssh_key_ids: formData.ssh_key_ids && formData.ssh_key_ids.length > 0 ? formData.ssh_key_ids : undefined,
    };
    createMutation.mutate(submitData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cursor-bg/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[80vh] bg-cursor-surface border border-cursor-border rounded-lg flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cursor-border">
          <h2 className="text-sm font-medium text-text-primary">Deploy Machine</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-4 py-2 border-b border-cursor-border">
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
                      'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                      isActive && 'bg-cursor-elevated text-text-primary',
                      canClick && 'text-status-success cursor-pointer hover:bg-cursor-elevated',
                      !isActive && !canClick && 'text-text-muted cursor-not-allowed'
                    )}
                  >
                    {isPast ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className={clsx(
                      'w-4 h-px mx-0.5',
                      isPast ? 'bg-status-success' : 'bg-cursor-border'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Provider Step */}
          {currentStep === 'provider' && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted mb-3">Select provider account</p>
              <div className="space-y-1">
                {providerAccounts?.map((account) => (
                  <button
                    key={account.provider_account_id}
                    onClick={() => setFormData({ ...formData, provider_account_id: account.provider_account_id })}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                      formData.provider_account_id === account.provider_account_id
                        ? 'bg-cursor-elevated border border-accent-blue/30'
                        : 'bg-cursor-surface border border-cursor-border hover:border-cursor-border-light'
                    )}
                  >
                    <div className="w-8 h-8 rounded bg-cursor-bg border border-cursor-border flex items-center justify-center">
                      <span className="text-[10px] font-mono text-text-muted">
                        {account.provider_type.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">{account.label}</p>
                      <p className="text-xs text-text-muted capitalize">{account.provider_type}</p>
                    </div>
                    <span className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded',
                      account.credential_status === 'valid' ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'
                    )}>
                      {account.credential_status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Config Step */}
          {currentStep === 'config' && providerOptions && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., prod-node-01"
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-text-muted mb-1 block">Region</label>
                <select
                  value={formData.region || ''}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="input"
                >
                  <option value="">Select...</option>
                  {providerOptions.regions.map((r) => (
                    <option key={r.slug} value={r.slug} disabled={!r.available}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-text-muted mb-1 block">Size</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto">
                  {providerOptions.sizes.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => setFormData({ ...formData, size: s.slug })}
                      disabled={!s.available}
                      className={clsx(
                        'text-left p-2 rounded-md border transition-colors',
                        formData.size === s.slug
                          ? 'bg-cursor-elevated border-accent-blue/30'
                          : 'bg-cursor-surface border-cursor-border hover:border-cursor-border-light',
                        !s.available && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <p className="font-mono text-xs text-text-primary">{s.slug}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {s.vcpus}vCPU · {s.memory_mb / 1024}GB · {s.disk_gb}GB
                      </p>
                      {s.price_monthly && (
                        <p className="text-[10px] text-accent-blue mt-0.5">${s.price_monthly}/mo</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-text-muted mb-1 block">Image</label>
                <select
                  value={formData.image || ''}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="input"
                >
                  <option value="">Select...</option>
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
            <div className="space-y-2">
              <p className="text-xs text-text-muted mb-3">Select firewall profile</p>
              <button
                onClick={() => setFormData({ ...formData, firewall_profile_id: 'none' })}
                className={clsx(
                  'w-full text-left p-3 rounded-md border transition-colors',
                  formData.firewall_profile_id === 'none'
                    ? 'bg-cursor-elevated border-accent-blue/30'
                    : 'bg-cursor-surface border-cursor-border hover:border-cursor-border-light'
                )}
              >
                <p className="text-sm text-text-primary">None</p>
                <p className="text-xs text-text-muted">Use provider defaults</p>
              </button>
              
              {firewallProfiles?.map((profile) => (
                <button
                  key={profile.profile_id}
                  onClick={() => setFormData({ ...formData, firewall_profile_id: profile.profile_id })}
                  className={clsx(
                    'w-full text-left p-3 rounded-md border transition-colors',
                    formData.firewall_profile_id === profile.profile_id
                      ? 'bg-cursor-elevated border-accent-blue/30'
                      : 'bg-cursor-surface border-cursor-border hover:border-cursor-border-light'
                  )}
                >
                  <p className="text-sm text-text-primary">{profile.name}</p>
                  <p className="text-xs text-text-muted">{profile.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {profile.rules.slice(0, 5).map((rule) => (
                      <span key={rule.rule_id} className="text-[10px] font-mono bg-cursor-bg px-1 py-0.5 rounded text-text-muted">
                        {rule.protocol}/{rule.port_range_start}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Bootstrap Step */}
          {currentStep === 'bootstrap' && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted mb-3">Select bootstrap profile</p>
              <button
                onClick={() => setFormData({ ...formData, bootstrap_profile_id: 'none' })}
                className={clsx(
                  'w-full text-left p-3 rounded-md border transition-colors',
                  formData.bootstrap_profile_id === 'none'
                    ? 'bg-cursor-elevated border-accent-blue/30'
                    : 'bg-cursor-surface border-cursor-border hover:border-cursor-border-light'
                )}
              >
                <p className="text-sm text-text-primary">None</p>
                <p className="text-xs text-text-muted">Vanilla OS installation</p>
              </button>
              
              {bootstrapProfiles?.map((profile) => (
                <button
                  key={profile.profile_id}
                  onClick={() => setFormData({ ...formData, bootstrap_profile_id: profile.profile_id })}
                  className={clsx(
                    'w-full text-left p-3 rounded-md border transition-colors',
                    formData.bootstrap_profile_id === profile.profile_id
                      ? 'bg-cursor-elevated border-accent-blue/30'
                      : 'bg-cursor-surface border-cursor-border hover:border-cursor-border-light'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-text-primary">{profile.name}</p>
                      <p className="text-xs text-text-muted">{profile.description}</p>
                    </div>
                    {profile.is_system_profile && (
                      <span className="text-[10px] bg-accent-blue/10 text-accent-blue px-1.5 py-0.5 rounded">
                        System
                      </span>
                    )}
                  </div>
                  {profile.services_to_run.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {profile.services_to_run.map((svc) => (
                        <span key={svc.service_name} className="text-[10px] font-mono bg-cursor-bg px-1 py-0.5 rounded text-text-muted">
                          {svc.display_name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Access Step */}
          {currentStep === 'access' && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted mb-3">Select SSH keys for access</p>
              
              <div
                className={clsx(
                  'p-3 rounded-md border transition-colors',
                  (!formData.ssh_key_ids || formData.ssh_key_ids.length === 0)
                    ? 'bg-cursor-elevated border-accent-blue/30'
                    : 'bg-cursor-surface border-cursor-border'
                )}
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-text-muted" />
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">None</p>
                    <p className="text-xs text-text-muted">Use provider default or password auth</p>
                  </div>
                  {(!formData.ssh_key_ids || formData.ssh_key_ids.length === 0) && (
                    <Check className="w-4 h-4 text-accent-blue" />
                  )}
                </div>
              </div>

              {availableSSHKeys.length > 0 ? (
                availableSSHKeys.map((key) => {
                  const isSelected = formData.ssh_key_ids?.includes(key.ssh_key_id);
                  return (
                    <button
                      key={key.ssh_key_id}
                      onClick={() => toggleSSHKey(key.ssh_key_id)}
                      className={clsx(
                        'w-full text-left p-3 rounded-md border transition-colors',
                        isSelected
                          ? 'bg-cursor-elevated border-accent-blue/30'
                          : 'bg-cursor-surface border-cursor-border hover:border-cursor-border-light'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Key className={clsx('w-4 h-4', isSelected ? 'text-accent-blue' : 'text-text-muted')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary">{key.name}</p>
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            <span className="font-mono">{key.key_type.toUpperCase()}</span>
                            <span className="flex items-center gap-1 font-mono truncate">
                              <Fingerprint className="w-3 h-3" />
                              {key.fingerprint.slice(0, 16)}...
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-accent-blue" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 bg-status-warning/5 border border-status-warning/20 rounded-md">
                  <p className="text-xs text-text-muted">
                    No SSH keys synced to {selectedAccount?.provider_type || 'this provider'}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <p className="text-xs text-text-muted mb-3">Review configuration</p>

              <div className="bg-cursor-bg rounded-md border border-cursor-border p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Name</span>
                  <span className="font-mono text-text-primary">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Provider</span>
                  <span className="text-text-primary">{selectedAccount?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Region</span>
                  <span className="font-mono text-text-primary">{formData.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Size</span>
                  <span className="font-mono text-text-primary">{formData.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Image</span>
                  <span className="font-mono text-text-primary truncate max-w-[180px]">{formData.image}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Firewall</span>
                  <span className="text-text-primary">
                    {formData.firewall_profile_id === 'none' 
                      ? 'None' 
                      : firewallProfiles?.find(f => f.profile_id === formData.firewall_profile_id)?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Bootstrap</span>
                  <span className="text-text-primary">
                    {formData.bootstrap_profile_id === 'none'
                      ? 'None'
                      : bootstrapProfiles?.find(b => b.profile_id === formData.bootstrap_profile_id)?.name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">SSH Keys</span>
                  <span className="text-text-primary">
                    {!formData.ssh_key_ids || formData.ssh_key_ids.length === 0
                      ? 'None'
                      : formData.ssh_key_ids.map(id => 
                          sshKeys?.find(k => k.ssh_key_id === id)?.name
                        ).filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-cursor-border">
          <button
            onClick={goBack}
            disabled={currentStepIndex === 0}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="btn btn-primary btn-sm"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Deploy
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="btn btn-primary btn-sm"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
