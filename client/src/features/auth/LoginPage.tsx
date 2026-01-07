import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { Eye, EyeOff, Zap, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Toggle } from '@/shared/ui/Toggle';
import styles from './LoginPage.module.css';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    isLoading,
    requiresSetup,
    devMode,
    login,
    devLogin,
    register,
    checkAuthStatus,
  } = useAuthStore();

  // If setup is required, force register mode
  const [mode, setMode] = useState<AuthMode>(requiresSetup ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Update mode when requiresSetup changes
  useEffect(() => {
    if (requiresSetup) {
      setMode('register');
    }
  }, [requiresSetup]);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: Location })?.from?.pathname || '/machines';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Clear form when switching modes
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'register') {
        // Validation
        if (!displayName.trim()) {
          setError('Display name is required');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setSubmitting(false);
          return;
        }
        await register(email, password, displayName);
      } else {
        // Login mode
        await login(email, password, rememberMe);
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevLogin = async () => {
    setError('');
    setSubmitting(true);

    try {
      await devLogin();
    } catch (err) {
      setError((err as Error).message || 'Dev login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isRegisterMode = mode === 'register';

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.formPanel}>
            <div className={styles.loadingContainer}>
              <img src="/machina_icon.png" alt="Machina" className={styles.loadingLogo} />
              <p className={styles.loadingText}>Loading...</p>
            </div>
          </div>
          <div className={styles.visualPanel}>
            <div className={styles.logoContainer}>
              <img src="/machina-login_icon.png" alt="Machina" className={styles.logo} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${isRegisterMode ? styles.setupMode : ''}`}>
        {/* Left Panel - Form */}
        <div className={styles.formPanel}>
          <div className={styles.brand}>
            <h2 className={styles.brandName}>Machina</h2>
          </div>

          <div className={styles.content}>
            <form onSubmit={handleSubmit} className={styles.form}>
              {isRegisterMode && (
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  disabled={submitting}
                  autoComplete="name"
                />
              )}

              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                disabled={submitting}
                autoComplete="email"
                autoFocus
              />

              <div className={styles.passwordWrapper}>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={submitting}
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {isRegisterMode && (
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  disabled={submitting}
                  autoComplete="new-password"
                />
              )}

              {error && (
                <div className={styles.error}>
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !email || !password}
                className={styles.submitButton}
              >
                {submitting ? 'Please wait...' : isRegisterMode ? 'Create Account' : 'Sign In'}
              </Button>

              {requiresSetup && (
                <p className={styles.setupNote}>
                  This will be the admin account for your Machina instance.
                </p>
              )}
            </form>

            {/* Remember me */}
            {!isRegisterMode && (
              <div className={styles.rememberRow}>
                <span className={styles.rememberLabel}>Remember me for 30 days</span>
                <Toggle
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={submitting}
                />
              </div>
            )}
          </div>

          {/* Mode switch */}
          {!requiresSetup && (
            <div className={styles.modeSwitch}>
              {isRegisterMode ? (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className={styles.modeSwitchLink}
                    onClick={() => switchMode('login')}
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className={styles.modeSwitchLink}
                    onClick={() => switchMode('register')}
                  >
                    Register
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Visual */}
        <div className={styles.visualPanel}>
          <div className={styles.logoContainer}>
            <img src="/machina-login_icon.png" alt="Machina" className={styles.logo} />
          </div>
        </div>
      </div>

      {/* Dev mode login - bottom right corner */}
      {devMode && !isRegisterMode && (
        <Button
          type="button"
          variant="ghost"
          onClick={handleDevLogin}
          disabled={submitting}
          className={styles.devButton}
        >
          <Zap size={14} />
          Quick Dev Login
        </Button>
      )}
    </div>
  );
}
