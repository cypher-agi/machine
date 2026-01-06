import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import styles from './TopBar.module.css';

export function TopBar() {
  const navigate = useNavigate();
  const { rightMenuOpen, setRightMenuOpen } = useAppStore();

  return (
    <header className={styles.topBar}>
      {/* Logo */}
      <div className={styles.logo} onClick={() => navigate('/machines')}>
        <img src="/machina_icon.png" alt="Machina" className={styles.logoIcon} />
        <span className={styles.logoText}>Machina</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Hamburger Menu */}
      <button
        className={styles.menuButton}
        onClick={() => setRightMenuOpen(!rightMenuOpen)}
        aria-label="Toggle menu"
      >
        {rightMenuOpen ? <X size={16} /> : <Menu size={16} />}
      </button>
    </header>
  );
}

