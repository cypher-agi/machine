import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Key, Copy, Download, Check, AlertTriangle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { generateSSHKey } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import type { SSHKeyType, SSHKeyGenerateResponse } from '@machine/shared';

interface GenerateKeyModalProps {
  onClose: () => void;
}

const keyTypes: { type: SSHKeyType; name: string; description: string }[] = [
  { type: 'ed25519', name: 'ED25519', description: 'Modern, secure, and fast. Recommended.' },
  { type: 'rsa', name: 'RSA', description: 'Classic algorithm. Use 4096 bits for security.' },
  { type: 'ecdsa', name: 'ECDSA', description: 'Elliptic curve. Smaller keys, good security.' },
];

export function GenerateKeyModal({ onClose }: GenerateKeyModalProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [keyType, setKeyType] = useState<SSHKeyType>('ed25519');
  const [keyBits, setKeyBits] = useState(4096);
  const [comment, setComment] = useState('');
  const [generatedKey, setGeneratedKey] = useState<SSHKeyGenerateResponse | null>(null);
  const [copied, setCopied] = useState<'public' | 'private' | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const generateMutation = useMutation({
    mutationFn: generateSSHKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setGeneratedKey(data);
      addToast({ type: 'success', title: 'SSH key generated', message: 'Save your private key securely!' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Generation failed', message: error.message });
    },
  });

  const handleGenerate = () => {
    if (!name.trim()) return;
    generateMutation.mutate({
      name: name.trim(),
      key_type: keyType,
      key_bits: keyType === 'rsa' ? keyBits : undefined,
      comment: comment.trim() || undefined,
    });
  };

  const copyToClipboard = async (text: string, type: 'public' | 'private') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      addToast({ type: 'error', title: 'Copy failed' });
    }
  };

  const downloadPrivateKey = () => {
    if (!generatedKey) return;
    const blob = new Blob([generatedKey.private_key], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_id_${keyType}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col animate-slide-in-up shadow-2xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-machine-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-neon-cyan" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-text-primary">Generate SSH Key</h2>
              <p className="text-sm text-text-secondary">Create a new SSH key pair</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!generatedKey ? (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Key Name <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production Servers"
                  className="input"
                  autoFocus
                />
              </div>

              {/* Key Type */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Key Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {keyTypes.map((kt) => (
                    <button
                      key={kt.type}
                      onClick={() => setKeyType(kt.type)}
                      className={clsx(
                        'card text-left p-3 transition-all',
                        keyType === kt.type
                          ? 'border-neon-cyan bg-neon-cyan/5'
                          : 'hover:border-machine-border-light'
                      )}
                    >
                      <p className="font-mono text-sm text-text-primary">{kt.name}</p>
                      <p className="text-xs text-text-secondary mt-1">{kt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* RSA Key Bits */}
              {keyType === 'rsa' && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Key Size (bits)
                  </label>
                  <select
                    value={keyBits}
                    onChange={(e) => setKeyBits(parseInt(e.target.value))}
                    className="input"
                  >
                    <option value={2048}>2048 (Minimum)</option>
                    <option value={4096}>4096 (Recommended)</option>
                  </select>
                </div>
              )}

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Comment <span className="text-text-tertiary">(optional)</span>
                </label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g., user@hostname"
                  className="input"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Success message */}
              <div className="flex items-center gap-3 p-4 bg-status-running/10 border border-status-running/20 rounded-lg">
                <Check className="w-5 h-5 text-status-running flex-shrink-0" />
                <div>
                  <p className="font-medium text-text-primary">Key Generated Successfully</p>
                  <p className="text-sm text-text-secondary">Fingerprint: {generatedKey.fingerprint}</p>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-4 bg-status-warning/10 border border-status-warning/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text-primary">Save Your Private Key</p>
                  <p className="text-sm text-text-secondary">
                    Download and store your private key securely. While it's encrypted in our database, 
                    you should always keep your own backup.
                  </p>
                </div>
              </div>

              {/* Public Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-primary">Public Key</label>
                  <button
                    onClick={() => copyToClipboard(generatedKey.public_key, 'public')}
                    className="btn btn-ghost btn-sm"
                  >
                    {copied === 'public' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'public' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-machine-elevated rounded-lg p-3 font-mono text-xs text-text-secondary break-all max-h-24 overflow-auto">
                  {generatedKey.public_key}
                </div>
              </div>

              {/* Private Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-primary">Private Key</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(generatedKey.private_key, 'private')}
                      className="btn btn-ghost btn-sm"
                    >
                      {copied === 'private' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied === 'private' ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={downloadPrivateKey}
                      className={clsx(
                        'btn btn-sm',
                        downloaded ? 'btn-secondary' : 'btn-primary'
                      )}
                    >
                      {downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                      {downloaded ? 'Downloaded' : 'Download'}
                    </button>
                  </div>
                </div>
                <div className="bg-machine-elevated rounded-lg p-3 font-mono text-xs text-text-secondary break-all max-h-32 overflow-auto">
                  {generatedKey.private_key}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-machine-border flex-shrink-0">
          {!generatedKey ? (
            <>
              <button onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!name.trim() || generateMutation.isPending}
                className="btn btn-primary"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Generate Key
                  </>
                )}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn btn-primary">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


