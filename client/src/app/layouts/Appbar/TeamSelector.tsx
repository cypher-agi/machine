import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, Plus, Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import styles from './TeamSelector.module.css';

export function TeamSelector() {
  const navigate = useNavigate();
  const { teams, currentTeamId, setCurrentTeam, teamsLoading, loadTeams } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentTeam = teams.find((t) => t.team_id === currentTeamId);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close on escape
  useEffect(() => {
    if (!menuOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen]);

  const handleSelectTeam = (teamId: string) => {
    setCurrentTeam(teamId);
    setMenuOpen(false);
    // Reload teams to refresh data with new context
    loadTeams();
    // Force reload of the current page data
    window.dispatchEvent(new CustomEvent('team-changed', { detail: { teamId } }));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (teamsLoading || !currentTeam) {
    return (
      <div className={styles.teamSelector}>
        <div className={styles.selectorButton}>
          <div className={styles.teamAvatar}>
            <Users size={14} />
          </div>
          <span className={styles.teamName}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.teamSelector} ref={menuRef}>
      <button
        className={styles.selectorButton}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
      >
        <div className={styles.teamAvatar}>
          {currentTeam.avatar_url ? (
            <img
              src={currentTeam.avatar_url}
              alt={currentTeam.name}
              className={styles.avatarImage}
            />
          ) : (
            <span className={styles.avatarInitials}>{getInitials(currentTeam.name)}</span>
          )}
        </div>
        <div className={styles.teamInfo}>
          <span className={styles.teamName}>{currentTeam.name}</span>
          <span className={styles.teamHandle}>@{currentTeam.handle}</span>
        </div>
        <ChevronDown size={14} className={clsx(styles.chevron, menuOpen && styles.chevronOpen)} />
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className={styles.menu} role="listbox">
          <div className={styles.menuLabel}>Switch Team</div>

          <div className={styles.teamList}>
            {teams.map((team) => (
              <button
                key={team.team_id}
                className={clsx(
                  styles.teamItem,
                  team.team_id === currentTeamId && styles.teamItemActive
                )}
                onClick={() => handleSelectTeam(team.team_id)}
                role="option"
                aria-selected={team.team_id === currentTeamId}
              >
                <div className={styles.teamAvatar}>
                  {team.avatar_url ? (
                    <img src={team.avatar_url} alt={team.name} className={styles.avatarImage} />
                  ) : (
                    <span className={styles.avatarInitials}>{getInitials(team.name)}</span>
                  )}
                </div>
                <div className={styles.teamItemInfo}>
                  <span className={styles.teamItemName}>{team.name}</span>
                  <span className={styles.teamItemMeta}>@{team.handle}</span>
                </div>
                {team.team_id === currentTeamId && <Check size={14} className={styles.checkIcon} />}
              </button>
            ))}
          </div>

          <div className={styles.menuDivider} />

          <button
            className={styles.menuAction}
            onClick={() => {
              setMenuOpen(false);
              navigate('/teams');
            }}
          >
            <Plus size={14} />
            <span>Manage Teams</span>
          </button>
        </div>
      )}
    </div>
  );
}
