import { useState, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Bot,
  Brain,
  Wrench,
  Wallet,
  Key,
  Sparkles,
  FileText,
  Loader2,
  BrainCog,
  RefreshCw,
  Camera,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  AgentCreateRequest,
  AgentExpertise,
  WalletChain,
  AgentPersonality,
} from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input, Select, Textarea } from '@/shared/ui';
import {
  mockAIProviderAccounts,
  mockSwarms,
  mockTools,
  EXPERTISE_CONFIG,
  AI_PROVIDER_CONFIG,
  PERSONALITY_TRAITS,
  PERSONALITY_TONES,
} from '../../mock';
import styles from './CreateAgentWizard.module.css';

interface CreateAgentWizardProps {
  onClose: () => void;
}

type WizardStep =
  | 'identity'
  | 'reasoning'
  | 'tools'
  | 'wallet'
  | 'credentials'
  | 'personality'
  | 'review';

const steps: { id: WizardStep; label: string; icon: typeof Bot }[] = [
  { id: 'identity', label: 'Identity', icon: Bot },
  { id: 'reasoning', label: 'Reasoning', icon: Brain },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'credentials', label: 'Access', icon: Key },
  { id: 'personality', label: 'Personality', icon: Sparkles },
  { id: 'review', label: 'Review', icon: FileText },
];

// Generate a random ZID
function generateZID(): string {
  const adjectives = ['swift', 'clever', 'bright', 'sharp', 'keen', 'quick', 'smart'];
  const nouns = ['agent', 'helper', 'assist', 'pilot', 'guide', 'bot'];
  const randomNum = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}-${randomNum}`;
}

export function CreateAgentWizard({ onClose }: CreateAgentWizardProps) {
  const { addToast } = useAppStore();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<WizardStep>('identity');
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<AgentCreateRequest>>({
    name: '',
    zid: generateZID(),
    swarm_id: '',
    ai_provider_account_id: '',
    expertise: 'generalist',
    enabled_tools: [],
    personality: {
      display_name: '',
      backstory: '',
      traits: [],
      tone: 'professional',
    },
  });

  const selectedProvider = mockAIProviderAccounts.find(
    (p) => p.ai_provider_account_id === formData.ai_provider_account_id
  );

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const canGoNext = () => {
    switch (currentStep) {
      case 'identity':
        return !!formData.name && !!formData.zid && !!formData.swarm_id;
      case 'reasoning':
        return !!formData.ai_provider_account_id && !!formData.expertise;
      case 'tools':
      case 'wallet':
      case 'credentials':
        return true;
      case 'personality':
        return (
          !!formData.personality?.display_name &&
          !!formData.personality?.backstory &&
          !!formData.personality?.tone
        );
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    const nextStep = steps[nextIndex];
    if (nextIndex < steps.length && nextStep) {
      setCurrentStep(nextStep.id);
      setMaxVisitedStep(Math.max(maxVisitedStep, nextIndex));
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    const prevStep = steps[prevIndex];
    if (prevIndex >= 0 && prevStep) {
      setCurrentStep(prevStep.id);
    }
  };

  const handleSubmit = async () => {
    setIsCreating(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsCreating(false);
    addToast({
      type: 'success',
      title: 'Agent created',
      message: `${formData.name} is being deployed`,
    });
    onClose();
  };

  const updatePersonality = (updates: Partial<AgentPersonality>) => {
    setFormData({
      ...formData,
      personality: { ...(formData.personality ?? {}), ...updates } as AgentPersonality,
    });
  };

  const toggleTool = (toolId: string) => {
    const current = formData.enabled_tools || [];
    if (current.includes(toolId)) {
      setFormData({ ...formData, enabled_tools: current.filter((t) => t !== toolId) });
    } else {
      setFormData({ ...formData, enabled_tools: [...current, toolId] });
    }
  };

  const toggleTrait = (trait: string) => {
    const current = formData.personality?.traits || [];
    if (current.includes(trait)) {
      updatePersonality({ traits: current.filter((t) => t !== trait) });
    } else {
      updatePersonality({ traits: [...current, trait] });
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large', message: 'Maximum size is 2MB' });
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      addToast({
        type: 'error',
        title: 'Invalid file type',
        message: 'Use JPG, PNG, GIF, or WebP',
      });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    updatePersonality({ avatar_url: previewUrl });

    // Reset input
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const avatarInitials =
    formData.personality?.display_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  const footer = (
    <div className={styles.footer}>
      <Button variant="secondary" size="sm" onClick={goBack} disabled={currentStepIndex === 0}>
        <ChevronLeft size={14} />
        Back
      </Button>

      {currentStep === 'review' ? (
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Check size={14} />
              Create Agent
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
      title="Create Agent"
      className={styles['modal'] ?? ''}
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

      {/* Content */}
      <div key={currentStep}>
        {/* Identity Step */}
        {currentStep === 'identity' && (
          <div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Agent Name</label>
              <Input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Code Review Assistant"
                autoFocus
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Zero ID (ZID)</label>
              <div className={styles.zidInput}>
                <Input
                  type="text"
                  value={formData.zid || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      zid: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    })
                  }
                  placeholder="unique-agent-id"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => setFormData({ ...formData, zid: generateZID() })}
                  title="Generate new ZID"
                >
                  <RefreshCw size={14} />
                </Button>
              </div>
              <p className={styles.formHint}>
                Unique identifier for this agent (lowercase, hyphens allowed)
              </p>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Swarm</label>
              <div className={styles.swarmList}>
                {mockSwarms.map((swarm) => (
                  <button
                    key={swarm.swarm_id}
                    onClick={() => setFormData({ ...formData, swarm_id: swarm.swarm_id })}
                    className={clsx(
                      styles.swarmButton,
                      formData.swarm_id === swarm.swarm_id && styles.swarmButtonSelected
                    )}
                  >
                    <div className={styles.swarmInfo}>
                      <p className={styles.swarmName}>{swarm.name}</p>
                      <p className={styles.swarmUrl}>
                        {swarm.url}:{swarm.port}
                      </p>
                    </div>
                    <div className={styles.swarmMeta}>
                      <span
                        className={clsx(
                          styles.swarmStatus,
                          swarm.status === 'active' && styles.swarmStatusActive
                        )}
                      >
                        {swarm.status}
                      </span>
                      <span className={styles.swarmAgents}>
                        {swarm.agent_count}/{swarm.max_agents} agents
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reasoning Step */}
        {currentStep === 'reasoning' && (
          <div>
            <p className={styles.sectionTitle}>Select AI Provider Account</p>
            {mockAIProviderAccounts.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <BrainCog size={32} />
                </div>
                <p className={styles.emptyStateTitle}>No AI providers configured</p>
                <p className={styles.emptyStateDesc}>
                  Add an AI provider account to power your agents.
                </p>
              </div>
            ) : (
              <div className={styles.providerList}>
                {mockAIProviderAccounts.map((account) => {
                  const config = AI_PROVIDER_CONFIG[account.provider];
                  return (
                    <button
                      key={account.ai_provider_account_id}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          ai_provider_account_id: account.ai_provider_account_id,
                        })
                      }
                      className={clsx(
                        styles.providerButton,
                        formData.ai_provider_account_id === account.ai_provider_account_id &&
                          styles.providerButtonSelected
                      )}
                    >
                      <div className={styles.providerIcon}>{config.abbreviation}</div>
                      <div className={styles.providerInfo}>
                        <p className={styles.providerLabel}>{account.label}</p>
                        <p className={styles.providerType}>{config.label}</p>
                      </div>
                      <span
                        className={clsx(
                          styles.credentialBadge,
                          account.credential_status === 'valid'
                            ? styles.credentialValid
                            : styles.credentialWarning
                        )}
                      >
                        {account.credential_status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.formField}>
              <label className={styles.formLabel}>Expertise</label>
              <Select
                value={formData.expertise || ''}
                onChange={(e) =>
                  setFormData({ ...formData, expertise: e.target.value as AgentExpertise })
                }
              >
                {Object.entries(EXPERTISE_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label} - {config.description}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Tools Step */}
        {currentStep === 'tools' && (
          <div>
            <p className={styles.sectionTitle}>Select tools for this agent</p>
            {['filesystem', 'network', 'blockchain', 'code', 'communication'].map((category) => {
              const categoryTools = mockTools.filter((t) => t.category === category);
              return (
                <div key={category} className={styles.toolCategory}>
                  <p className={styles.categoryTitle}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </p>
                  <div className={styles.toolGrid}>
                    {categoryTools.map((tool) => (
                      <button
                        key={tool.tool_id}
                        onClick={() => toggleTool(tool.tool_id)}
                        className={clsx(
                          styles.toolButton,
                          formData.enabled_tools?.includes(tool.tool_id) &&
                            styles.toolButtonSelected
                        )}
                      >
                        <div className={styles.toolHeader}>
                          <span className={styles.toolName}>{tool.name}</span>
                          {tool.requires_credentials && (
                            <Key size={10} className={styles.toolCredIcon} />
                          )}
                        </div>
                        <p className={styles.toolDesc}>{tool.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Wallet Step */}
        {currentStep === 'wallet' && (
          <div>
            <p className={styles.sectionTitle}>Configure blockchain wallet (optional)</p>
            <div className={styles.walletOptions}>
              <button
                onClick={() =>
                  setFormData({ ...formData, wallet_chain: undefined, wallet_address: undefined })
                }
                className={clsx(
                  styles.walletButton,
                  !formData.wallet_chain && styles.walletButtonSelected
                )}
              >
                <p className={styles.walletName}>No Wallet</p>
                <p className={styles.walletDesc}>Agent operates without blockchain capabilities</p>
              </button>
              {(['evm', 'solana', 'bitcoin'] as WalletChain[]).map((chain) => (
                <button
                  key={chain}
                  onClick={() => setFormData({ ...formData, wallet_chain: chain })}
                  className={clsx(
                    styles.walletButton,
                    formData.wallet_chain === chain && styles.walletButtonSelected
                  )}
                >
                  <p className={styles.walletName}>{chain.toUpperCase()}</p>
                  <p className={styles.walletDesc}>
                    {chain === 'evm' && 'Ethereum-compatible chains (ETH, Polygon, etc.)'}
                    {chain === 'solana' && 'Solana blockchain'}
                    {chain === 'bitcoin' && 'Bitcoin network'}
                  </p>
                </button>
              ))}
            </div>
            {formData.wallet_chain && (
              <div className={styles.formField}>
                <label className={styles.formLabel}>Wallet Address (optional)</label>
                <Input
                  type="text"
                  value={formData.wallet_address || ''}
                  onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                  placeholder="Import existing or leave empty to generate"
                />
                <p className={styles.formHint}>
                  Leave empty to generate a new wallet on deployment
                </p>
              </div>
            )}
          </div>
        )}

        {/* Credentials Step */}
        {currentStep === 'credentials' && (
          <div>
            <p className={styles.sectionTitle}>SSH key for secure operations (optional)</p>
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <Key size={32} />
              </div>
              <p className={styles.emptyStateTitle}>SSH keys coming soon</p>
              <p className={styles.emptyStateDesc}>
                SSH key binding for agents will be available in a future update.
              </p>
            </div>
          </div>
        )}

        {/* Personality Step */}
        {currentStep === 'personality' && (
          <div>
            {/* Avatar Selector */}
            <div className={styles.avatarField}>
              <div className={styles.avatarPreview} onClick={() => avatarInputRef.current?.click()}>
                {avatarPreview ? (
                  <>
                    <img src={avatarPreview} alt="Agent avatar" className={styles.avatarImage} />
                    <div className={styles.avatarOverlay}>
                      <Camera size={20} />
                    </div>
                  </>
                ) : (
                  <>
                    <span className={styles.avatarInitials}>{avatarInitials}</span>
                    <div className={styles.avatarOverlay}>
                      <Camera size={20} />
                    </div>
                  </>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarSelect}
                className={styles.fileInput}
              />
              <div className={styles.avatarActions}>
                <p className={styles.avatarLabel}>Agent Avatar</p>
                <p className={styles.avatarHint}>Click to upload (JPG, PNG, GIF, WebP · Max 2MB)</p>
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Display Name</label>
              <Input
                type="text"
                value={formData.personality?.display_name || ''}
                onChange={(e) => updatePersonality({ display_name: e.target.value })}
                placeholder="How the agent introduces itself (e.g., Alex)"
                autoFocus
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Backstory</label>
              <Textarea
                value={formData.personality?.backstory || ''}
                onChange={(e) => updatePersonality({ backstory: e.target.value })}
                placeholder="Describe the agent's background, purpose, and expertise..."
                rows={4}
              />
              <p className={styles.formHint}>
                {(formData.personality?.backstory || '').length}/500 characters
              </p>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Personality Traits</label>
              <div className={styles.traitGrid}>
                {PERSONALITY_TRAITS.map((trait) => (
                  <button
                    key={trait}
                    onClick={() => toggleTrait(trait)}
                    className={clsx(
                      styles.traitButton,
                      formData.personality?.traits?.includes(trait) && styles.traitButtonSelected
                    )}
                  >
                    {trait}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Communication Tone</label>
              <Select
                value={formData.personality?.tone || ''}
                onChange={(e) =>
                  updatePersonality({ tone: e.target.value as AgentPersonality['tone'] })
                }
              >
                {PERSONALITY_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {tone.charAt(0).toUpperCase() + tone.slice(1)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Review Step */}
        {currentStep === 'review' && (
          <div>
            <p className={styles.sectionTitle}>Review configuration</p>
            <div className={styles.reviewCard}>
              <div className={styles.reviewSection}>
                <p className={styles.reviewSectionTitle}>Identity</p>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Name</span>
                  <span className={styles.reviewValue}>{formData.name}</span>
                </div>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>ZID</span>
                  <span className={styles.reviewValueMono}>@{formData.zid}</span>
                </div>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Swarm</span>
                  <span className={styles.reviewValueNormal}>
                    {mockSwarms.find((s) => s.swarm_id === formData.swarm_id)?.name || '—'}
                  </span>
                </div>
              </div>

              <div className={styles.reviewSection}>
                <p className={styles.reviewSectionTitle}>Reasoning</p>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Provider</span>
                  <span className={styles.reviewValueNormal}>{selectedProvider?.label || '—'}</span>
                </div>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Expertise</span>
                  <span className={styles.reviewValueNormal}>
                    {EXPERTISE_CONFIG[formData.expertise || 'generalist']?.label || '—'}
                  </span>
                </div>
              </div>

              <div className={styles.reviewSection}>
                <p className={styles.reviewSectionTitle}>Tools</p>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Enabled</span>
                  <span className={styles.reviewValueNormal}>
                    {formData.enabled_tools?.length || 0} tools
                  </span>
                </div>
              </div>

              <div className={styles.reviewSection}>
                <p className={styles.reviewSectionTitle}>Wallet</p>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Chain</span>
                  <span className={styles.reviewValueNormal}>
                    {formData.wallet_chain?.toUpperCase() || 'None'}
                  </span>
                </div>
              </div>

              <div className={styles.reviewSection}>
                <p className={styles.reviewSectionTitle}>Personality</p>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Display Name</span>
                  <span className={styles.reviewValueNormal}>
                    {formData.personality?.display_name || '—'}
                  </span>
                </div>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Tone</span>
                  <span className={styles.reviewValueNormal}>
                    {formData.personality?.tone || '—'}
                  </span>
                </div>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Traits</span>
                  <span className={styles.reviewValueNormal}>
                    {formData.personality?.traits?.join(', ') || 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
