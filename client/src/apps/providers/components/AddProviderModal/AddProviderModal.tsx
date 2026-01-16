import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { createProviderAccount } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input } from '@/shared';
import type { ProviderType, ProviderCredentials } from '@machina/shared';
import clsx from 'clsx';
import styles from './AddProviderModal.module.css';

export interface AddProviderModalProps {
  onClose: () => void;
}

// Provider icons as inline SVGs (black and white)
const ProviderIcons: Record<ProviderType, React.ReactNode> = {
  digitalocean: (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.providerIcon}>
      <path d="M12.04 2C6.5 2 2 6.5 2 12.04c0 4.61 3.12 8.48 7.36 9.63v-3.72h-2.3v-2.18h2.3v-.63c0-3.04 1.35-4.38 4.28-4.38.56 0 1.52.11 1.91.22v2.01c-.21-.02-.57-.04-1.02-.04-1.45 0-2.01.55-2.01 1.97v.85h2.87l-.49 2.18h-2.38v3.86C18.56 21.1 22 17.01 22 12.04 22 6.5 17.5 2 12.04 2z" />
    </svg>
  ),
  aws: (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.providerIcon}>
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.176 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z" />
    </svg>
  ),
  gcp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.providerIcon}>
      <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-8.825-6.893zM8.073 19.015a4.14 4.14 0 0 1-2.108-.588l-.01.007.008-.03a4.137 4.137 0 0 1-.54-.343c-2.38-1.88-2.166-5.633.416-7.213l.006.008.009-.03a6.72 6.72 0 0 1 6.653-1.117 6.728 6.728 0 0 1 4.216 4.893l.029.03-.029-.007a6.667 6.667 0 0 1-.221 3.334 6.695 6.695 0 0 1-5.309 4.457 6.707 6.707 0 0 1-1.313.137c-.613 0-1.228-.08-1.807-.238z" />
    </svg>
  ),
  hetzner: (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.providerIcon}>
      <path d="M4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3zm2.25 4.5v9h2.25v-3.375h6v3.375h2.25v-9H15v3.375H9V7.5z" />
    </svg>
  ),
};

const providerOptions: { type: ProviderType; name: string; supported: boolean }[] = [
  { type: 'digitalocean', name: 'DigitalOcean', supported: true },
  { type: 'aws', name: 'AWS', supported: false },
  { type: 'gcp', name: 'Google Cloud', supported: false },
  { type: 'hetzner', name: 'Hetzner', supported: false },
];

export function AddProviderModal({ onClose }: AddProviderModalProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [label, setLabel] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [doToken, setDoToken] = useState('');

  const createMutation = useMutation({
    mutationFn: ({
      type,
      label,
      credentials,
    }: {
      type: ProviderType;
      label: string;
      credentials: ProviderCredentials;
    }) => createProviderAccount(type, { provider_type: type, label, credentials }),
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
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit() || createMutation.isPending}
          >
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
                <span className={styles.providerIconWrapper}>{ProviderIcons[provider.type]}</span>
                <span className={styles.providerName}>{provider.name}</span>
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
