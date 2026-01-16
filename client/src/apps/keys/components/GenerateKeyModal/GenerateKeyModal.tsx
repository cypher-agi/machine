import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Copy, Download, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { generateSSHKey } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input, Select } from '@/shared';
import type { SSHKeyType, SSHKeyGenerateResponse } from '@machina/shared';
import clsx from 'clsx';
import styles from './GenerateKeyModal.module.css';

export interface GenerateKeyModalProps {
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
      ...(keyType === 'rsa' && { key_bits: keyBits }),
      ...(comment.trim() && { comment: comment.trim() }),
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
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <div className={styles.keyTypeGrid}>
              {keyTypes.map((kt) => (
                <button
                  key={kt.type}
                  type="button"
                  onClick={() => setKeyType(kt.type)}
                  className={clsx(
                    styles.keyTypeButton,
                    keyType === kt.type && styles.keyTypeButtonSelected
                  )}
                >
                  <p className={styles.keyTypeName}>{kt.name}</p>
                  <p className={styles.keyTypeDesc}>{kt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {keyType === 'rsa' && (
            <div className={styles.field}>
              <label className={styles.label}>Key Size</label>
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

          <div className={styles.field}>
            <label className={styles.label}>Comment (optional)</label>
            <Input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="user@host"
            />
          </div>
        </div>
      ) : (
        <div className={styles.form}>
          <div className={styles.successBanner}>
            <Check size={16} className={styles.successIcon} />
            <div className={styles.successContent}>
              <p className={styles.successTitle}>Key generated</p>
              <p className={styles.successFingerprint}>{generatedKey.fingerprint}</p>
            </div>
          </div>

          <div className={styles.warningBanner}>
            <AlertTriangle size={16} className={styles.warningIcon} />
            <p className={styles.warningText}>Download and save your private key securely.</p>
          </div>

          <div className={styles.keySection}>
            <div className={styles.keySectionHeader}>
              <label className={styles.keySectionLabel}>Public Key</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(generatedKey.public_key, 'public')}
              >
                {copied === 'public' ? <Check size={12} /> : <Copy size={12} />}
                {copied === 'public' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className={styles.keyDisplay}>{generatedKey.public_key}</div>
          </div>

          <div className={styles.keySection}>
            <div className={styles.keySectionHeader}>
              <label className={styles.keySectionLabel}>Private Key</label>
              <div className={styles.keySectionActions}>
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
            <div className={clsx(styles.keyDisplay, styles.keyDisplayTall)}>
              {generatedKey.private_key}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
