import { useState } from 'react';
import { Plus, ShieldCheck, ShieldAlert, Trash2, RefreshCw, Pencil } from 'lucide-react';
import clsx from 'clsx';
import type { AIProviderAccount } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { Modal, Button } from '@/shared/ui';
import { mockAIProviderAccounts, AI_PROVIDER_CONFIG } from '../../mock';
import { AddAIProviderModal } from './AddAIProviderModal';
import styles from './AIProvidersModal.module.css';

interface AIProvidersModalProps {
  onClose: () => void;
}

export function AIProvidersModal({ onClose }: AIProvidersModalProps) {
  const { addToast } = useAppStore();
  const [providers, setProviders] = useState<AIProviderAccount[]>(mockAIProviderAccounts);
  const [showAddModal, setShowAddModal] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleVerify = async (providerId: string) => {
    setVerifyingId(providerId);
    // Simulate verification
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setProviders((prev) =>
      prev.map((p) =>
        p.ai_provider_account_id === providerId
          ? {
              ...p,
              credential_status: 'valid' as const,
              last_verified_at: new Date().toISOString(),
            }
          : p
      )
    );
    setVerifyingId(null);
    addToast({ type: 'success', title: 'Verified', message: 'Credentials are valid' });
  };

  const handleDelete = (providerId: string) => {
    setProviders((prev) => prev.filter((p) => p.ai_provider_account_id !== providerId));
    addToast({ type: 'info', title: 'Deleted', message: 'AI provider account removed' });
  };

  const handleAddProvider = (provider: AIProviderAccount) => {
    setProviders((prev) => [...prev, provider]);
    setShowAddModal(false);
    addToast({ type: 'success', title: 'Added', message: 'AI provider account created' });
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="AI Provider Accounts"
        className={styles['modal'] ?? ''}
        footer={
          <div className={styles.footer}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus size={14} />
              Add Provider
            </Button>
          </div>
        }
      >
        {providers.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No AI providers configured</p>
            <p className={styles.emptyDesc}>
              Add an AI provider account to power your agents with reasoning capabilities.
            </p>
          </div>
        ) : (
          <div className={styles.providerList}>
            {providers.map((provider) => {
              const config = AI_PROVIDER_CONFIG[provider.provider];
              const isVerifying = verifyingId === provider.ai_provider_account_id;

              return (
                <div key={provider.ai_provider_account_id} className={styles.providerCard}>
                  <div className={styles.providerHeader}>
                    <div className={styles.providerIcon}>{config.abbreviation}</div>
                    <div className={styles.providerInfo}>
                      <p className={styles.providerLabel}>{provider.label}</p>
                      <p className={styles.providerMeta}>
                        {config.label}
                        {provider.last_verified_at && (
                          <>
                            {' · '}
                            Last verified {new Date(provider.last_verified_at).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        styles.statusBadge,
                        provider.credential_status === 'valid'
                          ? styles.statusValid
                          : provider.credential_status === 'unchecked'
                            ? styles.statusUnchecked
                            : styles.statusInvalid
                      )}
                    >
                      {provider.credential_status === 'valid' ? (
                        <ShieldCheck size={12} />
                      ) : (
                        <ShieldAlert size={12} />
                      )}
                      {provider.credential_status}
                    </div>
                  </div>
                  <div className={styles.providerActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVerify(provider.ai_provider_account_id)}
                      disabled={isVerifying}
                    >
                      <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} />
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(provider.ai_provider_account_id)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {showAddModal && (
        <AddAIProviderModal onClose={() => setShowAddModal(false)} onAdd={handleAddProvider} />
      )}
    </>
  );
}
