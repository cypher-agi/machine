import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import clsx from 'clsx';
import type { IntegrationType } from '@machina/shared';
import { getIntegrationSetupInfo, configureIntegration, startIntegrationConnect } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Modal, Button, Input } from '@/shared';
import styles from './ConnectIntegrationModal.module.css';

interface ConnectIntegrationModalProps {
  type: IntegrationType;
  name: string;
  isConfigured: boolean;
  onClose: () => void;
}

export function ConnectIntegrationModal({
  type,
  name,
  isConfigured,
  onClose,
}: ConnectIntegrationModalProps) {
  const { addToast } = useAppStore();
  const { currentTeamId } = useAuthStore();
  const queryClient = useQueryClient();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [configureSuccess, setConfigureSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch setup info
  const { data: setupInfo, isLoading } = useQuery({
    queryKey: ['integration-setup', currentTeamId, type],
    queryFn: () => getIntegrationSetupInfo(type),
  });

  // If already configured, skip to connect step
  useEffect(() => {
    if (isConfigured && setupInfo) {
      const lastStepIndex = setupInfo.steps.length - 1;
      setCurrentStepIndex(lastStepIndex);
      setMaxVisitedStep(lastStepIndex);
      setConfigureSuccess(true);
    }
  }, [isConfigured, setupInfo]);

  // Configure mutation
  const configureMutation = useMutation({
    mutationFn: () => configureIntegration(type, credentials),
    onSuccess: () => {
      setConfigureSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integration-status', type] });
      addToast({
        type: 'success',
        title: 'Credentials Saved',
        message: `${name} OAuth credentials have been configured`,
      });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: () => startIntegrationConnect(type),
    onSuccess: (data) => {
      // Redirect to OAuth URL
      window.location.href = data.url;
    },
    onError: (err: Error) => {
      setError(err.message);
      // If credentials were invalid/deleted server-side, reset to allow reconfiguration
      if (err.message.includes('not configured') || err.message.includes('corrupted')) {
        setConfigureSuccess(false);
        setCurrentStepIndex(0);
        setMaxVisitedStep(0);
        setCredentials({});
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
        queryClient.invalidateQueries({ queryKey: ['integration-status', type] });
      }
    },
  });

  const steps = setupInfo?.steps || [];
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const hasFields = currentStep?.fields && currentStep.fields.length > 0;

  const canGoNext = () => {
    if (!currentStep) return false;

    // If already configured, can proceed
    if (configureSuccess) return true;

    // If this step has fields, check if all required fields are filled
    if (hasFields && currentStep.fields) {
      return currentStep.fields.every(
        (field) => !field.required || (credentials[field.name] && credentials[field.name].trim())
      );
    }

    return true;
  };

  const goNext = () => {
    if (!canGoNext()) return;
    setError(null);

    // If this step has fields, save credentials
    if (hasFields && !configureSuccess) {
      configureMutation.mutate();
      return;
    }

    // If this is the last step and configured, connect
    if (isLastStep && configureSuccess) {
      connectMutation.mutate();
      return;
    }

    // Otherwise, go to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
      setMaxVisitedStep(Math.max(maxVisitedStep, nextIndex));
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStepIndex(prevIndex);
      setError(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({ type: 'success', title: 'Copied to clipboard' });
  };

  const getButtonText = () => {
    if (configureMutation.isPending) return 'Saving...';
    if (connectMutation.isPending) return 'Connecting...';
    if (isLastStep && configureSuccess) return 'Connect to GitHub';
    if (hasFields && !configureSuccess) return 'Save & Continue';
    return 'Next';
  };

  const footer = (
    <div className={styles.footer}>
      <Button
        variant="secondary"
        size="sm"
        onClick={currentStepIndex === 0 ? onClose : goBack}
        disabled={configureMutation.isPending || connectMutation.isPending}
      >
        {currentStepIndex === 0 ? (
          'Cancel'
        ) : (
          <>
            <ChevronLeft size={14} />
            Back
          </>
        )}
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={goNext}
        disabled={!canGoNext() || configureMutation.isPending || connectMutation.isPending}
      >
        {configureMutation.isPending || connectMutation.isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {getButtonText()}
          </>
        ) : isLastStep && configureSuccess ? (
          <>
            <ExternalLink size={14} />
            {getButtonText()}
          </>
        ) : (
          <>
            {getButtonText()}
            <ChevronRight size={14} />
          </>
        )}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <Modal isOpen onClose={onClose} title={`Connect ${name}`} size="sm">
        <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <Loader2 size={24} className="animate-spin" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Connect ${name}`}
      className={styles.modal}
      footer={footer}
      animateHeight
    >
      {/* Steps indicator */}
      <div className={styles.stepsContainer}>
        <div className={styles.steps}>
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isVisited = index <= maxVisitedStep;
            const isPast = index < currentStepIndex;
            const canClick = isVisited && !isActive;

            return (
              <div key={step.id} className={styles.stepItem}>
                <button
                  onClick={() => canClick && setCurrentStepIndex(index)}
                  disabled={!canClick && !isActive}
                  className={clsx(
                    styles.stepButton,
                    isActive && styles.stepButtonActive,
                    isPast && styles.stepButtonDone
                  )}
                >
                  {isPast ? <Check size={14} /> : <span>{index + 1}</span>}
                  <span>{step.title}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={clsx(styles.stepDivider, isPast && styles.stepDividerDone)} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content} key={currentStepIndex}>
        {currentStep && (
          <div className={styles.stepContent}>
            <h3 className={styles.stepTitle}>{currentStep.title}</h3>
            <p className={styles.stepDescription}>{currentStep.description}</p>

            {/* Show callback URL for create-app step */}
            {setupInfo?.callbackUrl && currentStep.id === 'create-app' && (
              <div className={styles.callbackBox}>
                <div className={styles.callbackLabel}>Authorization callback URL</div>
                <div className={styles.callbackUrl}>
                  <span className={styles.callbackUrlText}>{setupInfo.callbackUrl}</span>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => copyToClipboard(setupInfo.callbackUrl)}
                    title="Copy to clipboard"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* External link */}
            {currentStep.externalUrl && (
              <a
                href={currentStep.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
              >
                <ExternalLink size={14} />
                Open {name} Settings
              </a>
            )}

            {/* Error message */}
            {error && (
              <div className={styles.errorMessage}>
                <p className={styles.errorText}>{error}</p>
              </div>
            )}

            {/* Fields form */}
            {hasFields && !configureSuccess && currentStep.fields && (
              <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
                {currentStep.fields.map((field) => (
                  <div key={field.name} className={styles.field}>
                    <label className={styles.fieldLabel}>
                      {field.label}
                      {field.required && ' *'}
                    </label>
                    <div className={styles.inputWrapper}>
                      <Input
                        type={
                          field.type === 'password' && !showSecrets[field.name]
                            ? 'password'
                            : 'text'
                        }
                        value={credentials[field.name] || ''}
                        onChange={(e) =>
                          setCredentials({ ...credentials, [field.name]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        mono={field.type !== 'url'}
                        size="sm"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          className={styles.toggleSecretButton}
                          onClick={() =>
                            setShowSecrets({
                              ...showSecrets,
                              [field.name]: !showSecrets[field.name],
                            })
                          }
                        >
                          {showSecrets[field.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                    {field.helpText && <p className={styles.fieldHint}>{field.helpText}</p>}
                  </div>
                ))}
              </form>
            )}

            {/* Success state after configuring */}
            {hasFields && configureSuccess && (
              <div className={styles.successState}>
                <div className={styles.successIcon}>
                  <CheckCircle size={28} />
                </div>
                <h4 className={styles.successTitle}>Credentials Configured</h4>
                <p className={styles.successDescription}>
                  Click &quot;Connect to {name}&quot; to authorize access to your account.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
