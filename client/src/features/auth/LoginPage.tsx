import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
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

  // Show nothing while checking auth status
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <img src="/machina_icon.png" alt="Machina" className={styles.logo} />
            <p className={styles.subtitle}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.card} ${isRegisterMode ? styles.setupMode : ''}`}>
        <div className={styles.header}>
          <img src="/machina_icon.png" alt="Machina" className={styles.logo} />
          <h1 className={styles.title}>
            {requiresSetup ? 'Welcome to Machina' : isRegisterMode ? 'Create Account' : 'Sign In'}
          </h1>
          <p className={styles.subtitle}>
            {requiresSetup
              ? 'Create your admin account to get started'
              : isRegisterMode
                ? 'Register a new account'
                : 'Enter your credentials to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {isRegisterMode && (
            <div className={styles.field}>
              <label htmlFor="displayName" className={styles.label}>
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={styles.input}
                disabled={submitting}
                autoComplete="name"
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={styles.input}
              disabled={submitting}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              disabled={submitting}
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
            />
          </div>

          {isRegisterMode && (
            <div className={styles.field}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.input}
                disabled={submitting}
                autoComplete="new-password"
              />
            </div>
          )}

          {!isRegisterMode && (
            <div className={styles.checkboxRow}>
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={styles.checkbox}
                disabled={submitting}
              />
              <label htmlFor="rememberMe" className={styles.checkboxLabel}>
                Remember me for 30 days
              </label>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <span>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting || !email || !password}
          >
            {submitting ? 'Please wait...' : isRegisterMode ? 'Create Account' : 'Sign In'}
          </button>

          {requiresSetup && (
            <p className={styles.setupNote}>
              This will be the admin account for your Machina instance.
            </p>
          )}
        </form>

        {/* Mode switch - always show unless in setup mode */}
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

        {/* Dev login - only show in development mode and login mode */}
        {devMode && !isRegisterMode && (
          <>
            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>Dev Mode</span>
              <span className={styles.dividerLine} />
            </div>

            <button
              type="button"
              onClick={handleDevLogin}
              className={styles.devButton}
              disabled={submitting}
            >
              <span className={styles.devIcon}>⚡</span>
              Quick Dev Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
