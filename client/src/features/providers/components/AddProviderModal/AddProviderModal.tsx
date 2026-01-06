import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import clsx from 'clsx';
import { createProviderAccount } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input, Select } from '@/shared/ui';
import type { ProviderType, ProviderCredentials } from '@machina/shared';

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
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
            Provider
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
            {providerOptions.map((provider) => (
              <button
                key={provider.type}
                type="button"
                onClick={() => provider.supported && setSelectedProvider(provider.type)}
                disabled={!provider.supported}
                style={{
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedProvider === provider.type ? 'rgba(94, 158, 255, 0.3)' : 'var(--color-border)'}`,
                  backgroundColor: selectedProvider === provider.type ? 'var(--color-elevated)' : 'var(--color-bg)',
                  textAlign: 'center',
                  cursor: provider.supported ? 'pointer' : 'not-allowed',
                  opacity: provider.supported ? 1 : 0.4,
                }}
              >
                <span style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  {provider.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {selectedProvider && (
          <>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                Label
              </label>
              <Input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Production"
                required
              />
            </div>

            {selectedProvider === 'digitalocean' && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                  API Token
                </label>
                <div style={{ position: 'relative' }}>
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
                    style={{
                      position: 'absolute',
                      right: 'var(--space-2)',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                  Get token at{' '}
                  <a
                    href="https://cloud.digitalocean.com/account/api/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-accent)' }}
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

