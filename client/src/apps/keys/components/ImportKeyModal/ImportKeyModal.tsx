import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2, Key } from 'lucide-react';
import { importSSHKey } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Modal, Button, Input } from '@/shared';
import styles from './ImportKeyModal.module.css';

export interface ImportKeyModalProps {
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
      ...(privateKey.trim() && { private_key: privateKey.trim() }),
      ...(comment.trim() && { comment: comment.trim() }),
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
    <Modal isOpen={true} onClose={onClose} title="Import SSH Key" size="sm" footer={footer}>
      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Existing Key"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <label className={styles.label}>Public Key</label>
            <label className={styles.uploadLabel}>
              <Button variant="ghost" size="sm" as="span">
                <Upload size={12} />
                Upload
              </Button>
              <input
                type="file"
                accept=".pub,*"
                className={styles.hiddenInput}
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
            className={styles.textarea}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <label className={styles.label}>Private Key (optional)</label>
            <label className={styles.uploadLabel}>
              <Button variant="ghost" size="sm" as="span">
                <Upload size={12} />
                Upload
              </Button>
              <input
                type="file"
                className={styles.hiddenInput}
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
            className={styles.textarea}
          />
          <p className={styles.hint}>If provided, encrypted before storage</p>
        </div>

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
    </Modal>
  );
}
