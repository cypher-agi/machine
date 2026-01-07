import { useNavigate } from 'react-router-dom';
import styles from './Topbar.module.css';

export function Topbar() {
  const navigate = useNavigate();

  return (
    <header className={styles.topbar}>
      {/* Logo Icon */}
      <div className={styles.logoIcon} onClick={() => navigate('/machines')}>
        <img src="/machina_icon.png" alt="Machina" className={styles.logoImage} />
      </div>

      {/* Centered App Name */}
      <span className={styles.logoText}>MACHINA</span>
    </header>
  );
}
