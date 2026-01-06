import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { createProviderAccount } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input } from '@/shared/ui';
import type { ProviderType, ProviderCredentials } from '@machina/shared';
import clsx from 'clsx';
import styles from './AddProviderModal.module.css';

interface AddProviderModalProps {
  onClose: () => void;
}

const providerOptions: { type: ProviderType; name: string; label: string; supported: boolean }[] = [
  { type: 'digitalocean', name: 'DigitalOcean', label: 'DO', supported: true },
  { type: 'aws', name: 'AWS', label: 'AWS', supported: false },
  { type: 'gcp', name: 'Google Cloud', label: 'GCP', supported: false },
  { type: 'hetzner', name: 'Hetzner', label: 'HZ', supported: false },
];

export function AddProviderModal({ onClose }: AddProviderModalProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [label, setLabel] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [doToken, setDoToken] = useState('');

  const createMutation = useMutation({
    mutationFn: ({ type, label, credentials }: { type: ProviderType; label: string; credentials: ProviderCredentials }) =>
      createProviderAccount(type, { provider_type: type, label, credentials }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Provider added' });
      onClose();
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Failed to add provider', message: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProvider || !label) return;

    let credentials: ProviderCredentials;

    if (selectedProvider === 'digitalocean') {
      if (!doToken) {
        addToast({ type: 'error', title: 'Missing credentials', message: 'API token is required' });
        return;
      }
      credentials = { type: 'digitalocean', api_token: doToken };
    } else {
      return;
    }

    createMutation.mutate({ type: selectedProvider, label, credentials });
  };

  const canSubmit = () => {
    if (!selectedProvider || !label) return false;
    if (selectedProvider === 'digitalocean' && !doToken) return false;
    return true;
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Provider"
      size="sm"
      animateHeight
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit() || createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Check size={14} />
                Add
              </>
            )}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Provider</label>
          <div className={styles.providerGrid}>
            {providerOptions.map((provider) => (
              <button
                key={provider.type}
                type="button"
                onClick={() => provider.supported && setSelectedProvider(provider.type)}
                disabled={!provider.supported}
                className={clsx(
                  styles.providerButton,
                  selectedProvider === provider.type && styles.providerButtonSelected
                )}
              >
                <span className={styles.providerLabel}>{provider.label}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedProvider && (
          <>
            <div className={styles.field}>
              <label className={clsx(styles.label, styles.labelSmall)}>Label</label>
              <Input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Production"
                required
              />
            </div>

            {selectedProvider === 'digitalocean' && (
              <div className={styles.field}>
                <label className={clsx(styles.label, styles.labelSmall)}>API Token</label>
                <div className={styles.tokenInputWrapper}>
                  <Input
                    type={showSecrets ? 'text' : 'password'}
                    value={doToken}
                    onChange={(e) => setDoToken(e.target.value)}
                    placeholder="dop_v1_..."
                    mono
                    size="sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className={styles.toggleSecretButton}
                  >
                    {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className={styles.hint}>
                  Get token at{' '}
                  <a
                    href="https://cloud.digitalocean.com/account/api/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.hintLink}
                  >
                    cloud.digitalocean.com
                  </a>
                </p>
              </div>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
