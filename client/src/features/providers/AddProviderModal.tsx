import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import clsx from 'clsx';
import { createProviderAccount } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import type { ProviderType, ProviderCredentials } from '@machine/shared';

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
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [label, setLabel] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [doToken, setDoToken] = useState('');
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');

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
    } else if (selectedProvider === 'aws') {
      if (!awsAccessKey || !awsSecretKey) {
        addToast({ type: 'error', title: 'Missing credentials', message: 'Access key and secret key are required' });
        return;
      }
      credentials = { 
        type: 'aws', 
        access_key_id: awsAccessKey, 
        secret_access_key: awsSecretKey,
        region: awsRegion
      };
    } else {
      return;
    }

    createMutation.mutate({ type: selectedProvider, label, credentials });
  };

  const canSubmit = () => {
    if (!selectedProvider || !label) return false;
    if (selectedProvider === 'digitalocean' && !doToken) return false;
    if (selectedProvider === 'aws' && (!awsAccessKey || !awsSecretKey)) return false;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cursor-bg/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-cursor-surface border border-cursor-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cursor-border">
          <h2 className="text-sm font-medium text-text-primary">Add Provider</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="text-xs text-text-muted mb-2 block">Provider</label>
              <div className="grid grid-cols-4 gap-2">
                {providerOptions.map((provider) => (
                  <button
                    key={provider.type}
                    type="button"
                    onClick={() => provider.supported && setSelectedProvider(provider.type)}
                    disabled={!provider.supported}
                    className={clsx(
                      'p-2 rounded-md border text-center transition-colors',
                      selectedProvider === provider.type
                        ? 'bg-cursor-elevated border-accent-blue/30'
                        : 'bg-cursor-bg border-cursor-border hover:border-cursor-border-light',
                      !provider.supported && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <span className="text-[10px] font-mono text-text-muted">{provider.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedProvider && (
              <>
                {/* Label */}
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Label</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Production"
                    className="input"
                    required
                  />
                </div>

                {/* DigitalOcean Credentials */}
                {selectedProvider === 'digitalocean' && (
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">API Token</label>
                    <div className="relative">
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={doToken}
                        onChange={(e) => setDoToken(e.target.value)}
                        placeholder="dop_v1_..."
                        className="input pr-8 font-mono text-xs"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                      >
                        {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      Get token at{' '}
                      <a
                        href="https://cloud.digitalocean.com/account/api/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-blue hover:underline"
                      >
                        cloud.digitalocean.com
                      </a>
                    </p>
                  </div>
                )}

                {/* AWS Credentials */}
                {selectedProvider === 'aws' && (
                  <>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Access Key ID</label>
                      <input
                        type="text"
                        value={awsAccessKey}
                        onChange={(e) => setAwsAccessKey(e.target.value)}
                        placeholder="AKIA..."
                        className="input font-mono text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Secret Access Key</label>
                      <div className="relative">
                        <input
                          type={showSecrets ? 'text' : 'password'}
                          value={awsSecretKey}
                          onChange={(e) => setAwsSecretKey(e.target.value)}
                          className="input pr-8 font-mono text-xs"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecrets(!showSecrets)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                        >
                          {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Region</label>
                      <select
                        value={awsRegion}
                        onChange={(e) => setAwsRegion(e.target.value)}
                        className="input text-xs"
                      >
                        <option value="us-east-1">us-east-1</option>
                        <option value="us-west-2">us-west-2</option>
                        <option value="eu-west-1">eu-west-1</option>
                        <option value="ap-northeast-1">ap-northeast-1</option>
                      </select>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-cursor-border">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit() || createMutation.isPending}
              className="btn btn-primary btn-sm"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Add
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
