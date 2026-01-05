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

const providerOptions: { type: ProviderType; name: string; icon: string; supported: boolean }[] = [
  { type: 'digitalocean', name: 'DigitalOcean', icon: '🌊', supported: true },
  { type: 'aws', name: 'AWS', icon: '☁️', supported: false },
  { type: 'gcp', name: 'Google Cloud', icon: '🔷', supported: false },
  { type: 'hetzner', name: 'Hetzner', icon: '🏢', supported: false },
];

export function AddProviderModal({ onClose }: AddProviderModalProps) {
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
  
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [label, setLabel] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  
  // DigitalOcean credentials
  const [doToken, setDoToken] = useState('');
  
  // AWS credentials
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');

  const createMutation = useMutation({
    mutationFn: ({ type, label, credentials }: { type: ProviderType; label: string; credentials: ProviderCredentials }) =>
      createProviderAccount(type, { provider_type: type, label, credentials }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-accounts'] });
      addToast({ type: 'success', title: 'Provider added', message: 'Account created successfully' });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl animate-slide-in-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-machine-border">
          <h2 className="font-semibold text-lg text-text-primary">Add Provider Account</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Select Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                {providerOptions.map((provider) => (
                  <button
                    key={provider.type}
                    type="button"
                    onClick={() => provider.supported && setSelectedProvider(provider.type)}
                    disabled={!provider.supported}
                    className={clsx(
                      'card flex items-center gap-3 p-3 transition-all',
                      selectedProvider === provider.type
                        ? 'border-neon-cyan bg-neon-cyan/5'
                        : 'hover:border-machine-border-light',
                      !provider.supported && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <span className="text-2xl">{provider.icon}</span>
                    <div className="text-left">
                      <p className="font-medium text-text-primary">{provider.name}</p>
                      {!provider.supported && (
                        <p className="text-xs text-text-tertiary">Coming soon</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedProvider && (
              <>
                {/* Label */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Account Label
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={`e.g., ${selectedProvider === 'digitalocean' ? 'DO Production' : 'AWS Production'}`}
                    className="input"
                    required
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    A friendly name to identify this account
                  </p>
                </div>

                {/* DigitalOcean Credentials */}
                {selectedProvider === 'digitalocean' && (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      API Token
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={doToken}
                        onChange={(e) => setDoToken(e.target.value)}
                        placeholder="dop_v1_..."
                        className="input pr-10 font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets(!showSecrets)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                      >
                        {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">
                      Generate at{' '}
                      <a
                        href="https://cloud.digitalocean.com/account/api/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-cyan hover:underline"
                      >
                        DigitalOcean API Tokens
                      </a>
                    </p>
                  </div>
                )}

                {/* AWS Credentials */}
                {selectedProvider === 'aws' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Access Key ID
                      </label>
                      <input
                        type="text"
                        value={awsAccessKey}
                        onChange={(e) => setAwsAccessKey(e.target.value)}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        className="input font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Secret Access Key
                      </label>
                      <div className="relative">
                        <input
                          type={showSecrets ? 'text' : 'password'}
                          value={awsSecretKey}
                          onChange={(e) => setAwsSecretKey(e.target.value)}
                          placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                          className="input pr-10 font-mono"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecrets(!showSecrets)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                        >
                          {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Default Region
                      </label>
                      <select
                        value={awsRegion}
                        onChange={(e) => setAwsRegion(e.target.value)}
                        className="input"
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="us-east-2">US East (Ohio)</option>
                        <option value="us-west-1">US West (N. California)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">EU (Ireland)</option>
                        <option value="eu-central-1">EU (Frankfurt)</option>
                        <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                        <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                      </select>
                    </div>

                    <p className="text-xs text-text-tertiary">
                      Create IAM credentials at{' '}
                      <a
                        href="https://console.aws.amazon.com/iam/home#/security_credentials"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-cyan hover:underline"
                      >
                        AWS IAM Console
                      </a>
                    </p>
                  </>
                )}
              </>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-machine-border">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit() || createMutation.isPending}
              className="btn btn-primary"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Add Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

