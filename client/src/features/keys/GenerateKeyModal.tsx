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

const keyTypes: { type: SSHKeyType; name: string; desc: string }[] = [
  { type: 'ed25519', name: 'ED25519', desc: 'Recommended' },
  { type: 'rsa', name: 'RSA', desc: '4096 bits' },
  { type: 'ecdsa', name: 'ECDSA', desc: 'Elliptic' },
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
      addToast({ type: 'success', title: 'Key generated' });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cursor-bg/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-cursor-surface border border-cursor-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cursor-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-medium text-text-primary">Generate SSH Key</h2>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {!generatedKey ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production"
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-text-muted mb-1 block">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {keyTypes.map((kt) => (
                    <button
                      key={kt.type}
                      type="button"
                      onClick={() => setKeyType(kt.type)}
                      className={clsx(
                        'p-2 rounded-md border text-center transition-colors',
                        keyType === kt.type
                          ? 'bg-cursor-elevated border-accent-blue/30'
                          : 'bg-cursor-bg border-cursor-border hover:border-cursor-border-light'
                      )}
                    >
                      <p className="font-mono text-xs text-text-primary">{kt.name}</p>
                      <p className="text-[10px] text-text-muted">{kt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {keyType === 'rsa' && (
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Key Size</label>
                  <select
                    value={keyBits}
                    onChange={(e) => setKeyBits(parseInt(e.target.value))}
                    className="input text-xs"
                  >
                    <option value={2048}>2048 bits</option>
                    <option value={4096}>4096 bits</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-text-muted mb-1 block">Comment (optional)</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="user@host"
                  className="input"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-2 bg-status-success/5 border border-status-success/20 rounded-md">
                <Check className="w-4 h-4 text-status-success" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary">Key generated</p>
                  <p className="text-[10px] text-text-muted font-mono truncate">{generatedKey.fingerprint}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-status-warning/5 border border-status-warning/20 rounded-md">
                <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0" />
                <p className="text-[10px] text-text-muted">
                  Download and save your private key securely.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-muted">Public Key</label>
                  <button
                    onClick={() => copyToClipboard(generatedKey.public_key, 'public')}
                    className="btn btn-ghost btn-sm text-[10px]"
                  >
                    {copied === 'public' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === 'public' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="bg-cursor-bg rounded p-2 font-mono text-[10px] text-text-muted break-all max-h-20 overflow-auto">
                  {generatedKey.public_key}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-text-muted">Private Key</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyToClipboard(generatedKey.private_key, 'private')}
                      className="btn btn-ghost btn-sm text-[10px]"
                    >
                      {copied === 'private' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={downloadPrivateKey}
                      className={clsx(
                        'btn btn-sm text-[10px]',
                        downloaded ? 'btn-secondary' : 'btn-primary'
                      )}
                    >
                      {downloaded ? <Check className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                      {downloaded ? 'Downloaded' : 'Download'}
                    </button>
                  </div>
                </div>
                <div className="bg-cursor-bg rounded p-2 font-mono text-[10px] text-text-muted break-all max-h-24 overflow-auto">
                  {generatedKey.private_key}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-cursor-border flex-shrink-0">
          {!generatedKey ? (
            <>
              <button onClick={onClose} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!name.trim() || generateMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    Generate
                  </>
                )}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn btn-primary btn-sm">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
