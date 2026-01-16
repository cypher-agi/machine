import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { AIProviderAccount, ReasoningProvider } from '@machina/shared';
import { Modal, Button, Input } from '@/shared';
import { AI_PROVIDER_CONFIG } from '../../mock';
import styles from './AIProvidersModal.module.css';

interface AddAIProviderModalProps {
  onClose: () => void;
  onAdd: (provider: AIProviderAccount) => void;
}

export function AddAIProviderModal({ onClose, onAdd }: AddAIProviderModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<ReasoningProvider | null>(null);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canSubmit = () => {
    if (!selectedProvider || !label) return false;
    if (selectedProvider === 'local') {
      return !!endpointUrl;
    }
    return !!apiKey;
  };

  const handleSubmit = async () => {
    if (!canSubmit() || !selectedProvider) return;

    setIsCreating(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newProvider: AIProviderAccount = {
      ai_provider_account_id: `ai-provider-${Date.now()}`,
      team_id: 'team-1',
      provider: selectedProvider,
      label,
      credential_status: 'unchecked',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'user-1',
    };

    setIsCreating(false);
    onAdd(newProvider);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add AI Provider"
      className={styles['modal'] ?? ''}
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit() || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Adding...
              </>
            ) : (
              'Add Provider'
            )}
          </Button>
        </div>
      }
    >
      <div className={styles.addProviderContent}>
        <p className={styles.sectionTitle}>Select Provider</p>
        <div className={styles.providerTypeGrid}>
          {(
            Object.entries(AI_PROVIDER_CONFIG) as [
              ReasoningProvider,
              typeof AI_PROVIDER_CONFIG.anthropic,
            ][]
          ).map(([provider, config]) => (
            <button
              key={provider}
              onClick={() => setSelectedProvider(provider)}
              className={clsx(
                styles.providerTypeButton,
                selectedProvider === provider && styles.providerTypeButtonSelected
              )}
            >
              <div className={styles.providerTypeIcon}>{config.abbreviation}</div>
              <span>{config.label}</span>
            </button>
          ))}
        </div>

        {selectedProvider && (
          <>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Label</label>
              <Input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`e.g., Production ${AI_PROVIDER_CONFIG[selectedProvider].label}`}
                autoFocus
              />
            </div>

            {selectedProvider !== 'local' && (
              <div className={styles.formField}>
                <label className={styles.formLabel}>API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    selectedProvider === 'anthropic'
                      ? 'sk-ant-api03-...'
                      : selectedProvider === 'openai'
                        ? 'sk-...'
                        : 'API key'
                  }
                />
              </div>
            )}

            {selectedProvider === 'openai' && (
              <div className={styles.formField}>
                <label className={styles.formLabel}>Organization ID (optional)</label>
                <Input
                  type="text"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  placeholder="org-..."
                />
              </div>
            )}

            {selectedProvider === 'google' && (
              <div className={styles.formField}>
                <label className={styles.formLabel}>Project ID (optional)</label>
                <Input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="my-project-id"
                />
              </div>
            )}

            {selectedProvider === 'local' && (
              <>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Endpoint URL</label>
                  <Input
                    type="text"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Model Name (optional)</label>
                  <Input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="llama2"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
