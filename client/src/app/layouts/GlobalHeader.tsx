import { useNavigate } from 'react-router-dom';
import styles from './GlobalHeader.module.css';

export function GlobalHeader() {
  const navigate = useNavigate();

  return (
    <header className={styles.globalHeader}>
      {/* Logo */}
      <div className={styles.logo} onClick={() => navigate('/machines')}>
        <img src="/machina_icon.png" alt="Machina" className={styles.logoIcon} />
        <span className={styles.logoText}>Machina</span>
      </div>
    </header>
  );
}

