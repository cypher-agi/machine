import { useNavigate } from 'react-router-dom';
import styles from './Topbar.module.css';

export function Topbar() {
  const navigate = useNavigate();

  return (
    <header className={styles.topbar}>
      {/* Logo */}
      <div className={styles.logo} onClick={() => navigate('/machines')}>
        <img src="/machina_icon.png" alt="Machina" className={styles.logoIcon} />
        <span className={styles.logoText}>MACHINA</span>
      </div>
    </header>
  );
}
