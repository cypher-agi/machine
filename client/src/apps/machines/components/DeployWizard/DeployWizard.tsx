import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Cloud,
  Server,
  Shield,
  Package,
  FileText,
  Loader2,
  Key
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
import type { MachineCreateRequest } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input, Select } from '@/shared/ui';
import styles from './DeployWizard.module.css';

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

      if (!formData.region && providerOptions.regions.length > 0) {
        const sfRegion = providerOptions.regions.find(r => r.slug === 'sfo3' || r.slug.startsWith('sfo'));
        updates.region = sfRegion?.slug || providerOptions.regions[0].slug;
      }

      if (!formData.size && providerOptions.sizes.length > 0) {
        updates.size = providerOptions.sizes[0].slug;
      }

      if (!formData.image) {
        const defaultImage = providerOptions.images.find(img => img.slug === 'ubuntu-22-04-x64');
        updates.image = defaultImage?.slug || providerOptions.images[0]?.slug;
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
      case 'bootstrap':
      case 'access':
      case 'review':
        return true;
      default:
        return false;
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

  const footer = (
    <div className={styles.footer}>
      <Button variant="secondary" size="sm" onClick={goBack} disabled={currentStepIndex === 0}>
        <ChevronLeft size={14} />
        Back
      </Button>

      {currentStep === 'review' ? (
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Check size={14} />
              Deploy
            </>
          )}
        </Button>
      ) : (
        <Button variant="primary" size="sm" onClick={goNext} disabled={!canGoNext()}>
          Next
          <ChevronRight size={14} />
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Deploy Machine"
      className={styles.modal}
      footer={footer}
      animateHeight
    >
      {/* Steps indicator */}
      <div className={styles.stepsContainer}>
        <div className={styles.steps}>
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isVisited = index <= maxVisitedStep;
            const isPast = index < currentStepIndex;
            const canClick = isVisited && !isActive;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className={styles.stepItem}>
                <button
                  onClick={() => canClick && setCurrentStep(step.id)}
                  disabled={!canClick && !isActive}
                  className={clsx(
                    styles.stepButton,
                    isActive && styles.stepButtonActive,
                    isPast && styles.stepButtonDone
                  )}
                >
                  {isPast ? <Check size={14} /> : <StepIcon size={14} />}
                  <span>{step.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={clsx(styles.stepDivider, isPast && styles.stepDividerDone)} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content - key prop forces re-render for accurate height measurement */}
      <div key={currentStep}>
        {/* Provider Step */}
        {currentStep === 'provider' && (
          <div>
            <p className={styles.sectionTitle}>Select provider account</p>
            <div className={styles.providerList}>
              {providerAccounts?.map((account) => (
                <button
                  key={account.provider_account_id}
                  onClick={() => setFormData({ ...formData, provider_account_id: account.provider_account_id })}
                  className={clsx(
                    styles.providerButton,
                    formData.provider_account_id === account.provider_account_id && styles.providerButtonSelected
                  )}
                >
                  <div className={styles.providerIcon}>
                    {account.provider_type.slice(0, 2).toUpperCase()}
                  </div>
                  <div className={styles.providerInfo}>
                    <p className={styles.providerLabel}>{account.label}</p>
                    <p className={styles.providerType}>{account.provider_type}</p>
                  </div>
                  <span className={clsx(
                    styles.credentialBadge,
                    account.credential_status === 'valid' ? styles.credentialValid : styles.credentialWarning
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
          <div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Name</label>
              <Input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., prod-node-01"
                autoFocus
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Region</label>
              <Select
                value={formData.region || ''}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              >
                <option value="">Select...</option>
                {providerOptions.regions.map((r) => (
                  <option key={r.slug} value={r.slug} disabled={!r.available}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Size</label>
              <div className={styles.sizeGrid}>
                {providerOptions.sizes.map((s) => (
                  <button
                    key={s.slug}
                    onClick={() => setFormData({ ...formData, size: s.slug })}
                    disabled={!s.available}
                    className={clsx(
                      styles.sizeButton,
                      formData.size === s.slug && styles.sizeButtonSelected
                    )}
                  >
                    <p className={styles.sizeSlug}>{s.slug}</p>
                    <p className={styles.sizeDetails}>
                      {s.vcpus}vCPU · {s.memory_mb / 1024}GB · {s.disk_gb}GB
                    </p>
                    {s.price_monthly && (
                      <p className={styles.sizePrice}>${s.price_monthly}/mo</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Image</label>
              <Select
                value={formData.image || ''}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              >
                <option value="">Select...</option>
                {providerOptions.images.map((img) => (
                  <option key={img.slug} value={img.slug} disabled={!img.available}>
                    {img.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Firewall Step */}
        {currentStep === 'firewall' && (
          <div>
            <p className={styles.sectionTitle}>Select firewall profile</p>
            <button
              onClick={() => setFormData({ ...formData, firewall_profile_id: 'none' })}
              className={clsx(styles.profileButton, formData.firewall_profile_id === 'none' && styles.profileButtonSelected)}
            >
              <p className={styles.profileName}>None</p>
              <p className={styles.profileDesc}>Use provider defaults</p>
            </button>
            {firewallProfiles?.map((profile) => (
              <button
                key={profile.profile_id}
                onClick={() => setFormData({ ...formData, firewall_profile_id: profile.profile_id })}
                className={clsx(styles.profileButton, formData.firewall_profile_id === profile.profile_id && styles.profileButtonSelected)}
              >
                <p className={styles.profileName}>{profile.name}</p>
                <p className={styles.profileDesc}>{profile.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Bootstrap Step */}
        {currentStep === 'bootstrap' && (
          <div>
            <p className={styles.sectionTitle}>Select bootstrap profile</p>
            <button
              onClick={() => setFormData({ ...formData, bootstrap_profile_id: 'none' })}
              className={clsx(styles.profileButton, formData.bootstrap_profile_id === 'none' && styles.profileButtonSelected)}
            >
              <p className={styles.profileName}>None</p>
              <p className={styles.profileDesc}>Vanilla OS installation</p>
            </button>
            {bootstrapProfiles?.map((profile) => (
              <button
                key={profile.profile_id}
                onClick={() => setFormData({ ...formData, bootstrap_profile_id: profile.profile_id })}
                className={clsx(styles.profileButton, formData.bootstrap_profile_id === profile.profile_id && styles.profileButtonSelected)}
              >
                <p className={styles.profileName}>{profile.name}</p>
                <p className={styles.profileDesc}>{profile.description}</p>
                {profile.services_to_run.length > 0 && (
                  <div className={styles.profileTags}>
                    {profile.services_to_run.map((svc) => (
                      <span key={svc.service_name} className={styles.profileTag}>
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
          <div>
            <p className={styles.sectionTitle}>Select SSH keys for access (optional)</p>
            {sshKeys && sshKeys.length > 0 ? (
              sshKeys.map((key) => {
                const isSelected = formData.ssh_key_ids?.includes(key.ssh_key_id);
                return (
                  <button
                    key={key.ssh_key_id}
                    onClick={() => {
                      const currentKeys = formData.ssh_key_ids || [];
                      if (isSelected) {
                        setFormData({ ...formData, ssh_key_ids: currentKeys.filter(id => id !== key.ssh_key_id) });
                      } else {
                        setFormData({ ...formData, ssh_key_ids: [...currentKeys, key.ssh_key_id] });
                      }
                    }}
                    className={clsx(styles.profileButton, isSelected && styles.profileButtonSelected)}
                  >
                    <p className={styles.profileName}>{key.name}</p>
                    <p className={styles.profileDesc}>{key.key_type.toUpperCase()} · {key.fingerprint.slice(0, 16)}...</p>
                  </button>
                );
              })
            ) : (
              <p className={styles.emptyText}>
                No SSH keys available. You can add keys in the Keys page.
              </p>
            )}
          </div>
        )}

        {/* Review Step */}
        {currentStep === 'review' && (
          <div>
            <p className={styles.sectionTitle}>Review configuration</p>
            <div className={styles.reviewCard}>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Name</span>
                <span className={styles.reviewValue}>{formData.name}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Provider</span>
                <span className={styles.reviewValueNormal}>{selectedAccount?.label}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Region</span>
                <span className={styles.reviewValue}>{formData.region}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Size</span>
                <span className={styles.reviewValue}>{formData.size}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Image</span>
                <span className={styles.reviewValue}>{formData.image}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Firewall</span>
                <span className={styles.reviewValueNormal}>
                  {formData.firewall_profile_id === 'none'
                    ? 'None'
                    : firewallProfiles?.find(f => f.profile_id === formData.firewall_profile_id)?.name || '—'}
                </span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Bootstrap</span>
                <span className={styles.reviewValueNormal}>
                  {formData.bootstrap_profile_id === 'none'
                    ? 'None'
                    : bootstrapProfiles?.find(b => b.profile_id === formData.bootstrap_profile_id)?.name || '—'}
                </span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>SSH Keys</span>
                <span className={styles.reviewValueNormal}>
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
    </Modal>
  );
}
