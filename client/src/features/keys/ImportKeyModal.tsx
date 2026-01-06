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
      addToast({ type: 'success', title: 'SSH key imported' });
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
        // Try to extract name from filename if not set
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col animate-slide-in-up shadow-2xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-machine-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 border border-neon-purple/30 flex items-center justify-center">
              <Upload className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-text-primary">Import SSH Key</h2>
              <p className="text-sm text-text-secondary">Import an existing key pair</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Key Name <span className="text-status-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Existing Production Key"
              className="input"
              autoFocus
            />
          </div>

          {/* Public Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">
                Public Key <span className="text-status-error">*</span>
              </label>
              <label className="btn btn-ghost btn-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                Upload .pub
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
              placeholder="ssh-ed25519 AAAA... user@hostname"
              className="input font-mono text-xs resize-none"
              rows={3}
            />
            <p className="text-xs text-text-tertiary mt-1">
              Paste your public key or upload a .pub file
            </p>
          </div>

          {/* Private Key (optional) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">
                Private Key <span className="text-text-tertiary">(optional)</span>
              </label>
              <label className="btn btn-ghost btn-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                Upload key
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
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              className="input font-mono text-xs resize-none"
              rows={4}
            />
            <p className="text-xs text-text-tertiary mt-1">
              If provided, it will be encrypted and stored securely
            </p>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Comment <span className="text-text-tertiary">(optional)</span>
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Override the comment from the public key"
              className="input"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-machine-border flex-shrink-0">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!name.trim() || !publicKey.trim() || importMutation.isPending}
            className="btn btn-primary"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Import Key
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


