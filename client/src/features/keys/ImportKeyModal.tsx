import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Loader2, Key } from 'lucide-react';
import { importSSHKey } from '@/lib/api';
import { useAppStore } from '@/store/appStore';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cursor-bg/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-cursor-surface border border-cursor-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cursor-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-medium text-text-primary">Import SSH Key</h2>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Existing Key"
              className="input"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-text-muted">Public Key</label>
              <label className="btn btn-ghost btn-sm text-[10px] cursor-pointer">
                <Upload className="w-3 h-3" />
                Upload
                <input
                  type="file"
                  accept=".pub,*"
                  className="hidden"
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
              className="input font-mono text-[10px] resize-none"
              rows={3}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-text-muted">Private Key (optional)</label>
              <label className="btn btn-ghost btn-sm text-[10px] cursor-pointer">
                <Upload className="w-3 h-3" />
                Upload
                <input
                  type="file"
                  className="hidden"
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
              className="input font-mono text-[10px] resize-none"
              rows={3}
            />
            <p className="text-[10px] text-text-muted mt-1">
              If provided, encrypted before storage
            </p>
          </div>

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

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-cursor-border flex-shrink-0">
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!name.trim() || !publicKey.trim() || importMutation.isPending}
            className="btn btn-primary btn-sm"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5" />
                Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
