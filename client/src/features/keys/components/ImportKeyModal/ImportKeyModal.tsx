import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2, Key } from 'lucide-react';
import { importSSHKey } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input } from '@/shared/ui';

interface ImportKeyModalProps {
  onClose: () => void;
}

export function ImportKeyModal({ onClose }: ImportKeyModalProps) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [comment, setComment] = useState('');

  const importMutation = useMutation({
    mutationFn: importSSHKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      addToast({ type: 'success', title: 'Key imported' });
      onClose();
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Import failed', message: error.message });
    },
  });

  const handleImport = () => {
    if (!name.trim() || !publicKey.trim()) return;
    importMutation.mutate({
      name: name.trim(),
      public_key: publicKey.trim(),
      private_key: privateKey.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  };

  const handleFileUpload = async (type: 'public' | 'private', file: File) => {
    try {
      const content = await file.text();
      if (type === 'public') {
        setPublicKey(content.trim());
        if (!name) {
          const fileName = file.name.replace(/\.pub$/, '').replace(/^id_/, '');
          setName(fileName);
        }
      } else {
        setPrivateKey(content.trim());
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to read file' });
    }
  };

  const footer = (
    <>
      <Button variant="secondary" size="sm" onClick={onClose}>
        Cancel
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleImport}
        disabled={!name.trim() || !publicKey.trim() || importMutation.isPending}
      >
        {importMutation.isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <Key size={14} />
            Import
          </>
        )}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Import SSH Key"
      size="sm"
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
            Name
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Existing Key"
            autoFocus
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Public Key</label>
            <label style={{ cursor: 'pointer' }}>
              <Button variant="ghost" size="sm" as="span">
                <Upload size={12} />
                Upload
              </Button>
              <input
                type="file"
                accept=".pub,*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload('public', file);
                }}
              />
            </label>
          </div>
          <textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="ssh-ed25519 AAAA..."
            rows={3}
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              resize: 'none',
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Private Key (optional)</label>
            <label style={{ cursor: 'pointer' }}>
              <Button variant="ghost" size="sm" as="span">
                <Upload size={12} />
                Upload
              </Button>
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload('private', file);
                }}
              />
            </label>
          </div>
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={3}
            style={{
              width: '100%',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              resize: 'none',
            }}
          />
          <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            If provided, encrypted before storage
          </p>
        </div>

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
    </Modal>
  );
}

