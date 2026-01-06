import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Copy, Download, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { generateSSHKey } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input, Select } from '@/shared/ui';
import type { SSHKeyType, SSHKeyGenerateResponse } from '@machina/shared';

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

  const footer = !generatedKey ? (
    <>
      <Button variant="secondary" size="sm" onClick={onClose}>
        Cancel
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleGenerate}
        disabled={!name.trim() || generateMutation.isPending}
      >
        {generateMutation.isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Key size={14} />
            Generate
          </>
        )}
      </Button>
    </>
  ) : (
    <Button variant="primary" size="sm" onClick={onClose}>
      Done
    </Button>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Generate SSH Key"
      size="sm"
      animateHeight
      footer={footer}
    >
      {!generatedKey ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
              Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production"
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
              Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
              {keyTypes.map((kt) => (
                <button
                  key={kt.type}
                  type="button"
                  onClick={() => setKeyType(kt.type)}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${keyType === kt.type ? '#fff' : 'var(--color-border)'}`,
                    backgroundColor: keyType === kt.type ? 'var(--color-elevated)' : 'var(--color-bg)',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                    {kt.name}
                  </p>
                  <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-text-muted)' }}>{kt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {keyType === 'rsa' && (
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                Key Size
              </label>
              <Select
                value={keyBits}
                onChange={(e) => setKeyBits(parseInt(e.target.value))}
                size="sm"
              >
                <option value={2048}>2048 bits</option>
                <option value={4096}>4096 bits</option>
              </Select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
              Comment (optional)
            </label>
            <Input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="user@host"
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2)',
            backgroundColor: 'rgba(74, 222, 128, 0.05)',
            border: '1px solid rgba(74, 222, 128, 0.2)',
            borderRadius: 'var(--radius-md)',
          }}>
            <Check size={16} style={{ color: 'var(--color-success)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>Key generated</p>
              <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {generatedKey.fingerprint}
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            padding: 'var(--space-2)',
            backgroundColor: 'rgba(250, 204, 21, 0.05)',
            border: '1px solid rgba(250, 204, 21, 0.2)',
            borderRadius: 'var(--radius-md)',
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
            <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-text-muted)' }}>
              Download and save your private key securely.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Public Key</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(generatedKey.public_key, 'public')}
              >
                {copied === 'public' ? <Check size={12} /> : <Copy size={12} />}
                {copied === 'public' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div style={{
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              color: 'var(--color-text-muted)',
              wordBreak: 'break-all',
              maxHeight: '80px',
              overflow: 'auto',
            }}>
              {generatedKey.public_key}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Private Key</label>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedKey.private_key, 'private')}
                >
                  {copied === 'private' ? <Check size={12} /> : <Copy size={12} />}
                </Button>
                <Button
                  variant={downloaded ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={downloadPrivateKey}
                >
                  {downloaded ? <Check size={12} /> : <Download size={12} />}
                  {downloaded ? 'Downloaded' : 'Download'}
                </Button>
              </div>
            </div>
            <div style={{
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              color: 'var(--color-text-muted)',
              wordBreak: 'break-all',
              maxHeight: '96px',
              overflow: 'auto',
            }}>
              {generatedKey.private_key}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

