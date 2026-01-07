import { Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import styles from './Teambar.module.css';

export function Teambar() {
  const { teams, currentTeamId, setCurrentTeam, loadTeams } = useAuthStore();

  // Only show if there's more than one team
  if (teams.length <= 1) {
    return null;
  }

  const handleSelectTeam = (teamId: string) => {
    if (teamId === currentTeamId) return;
    setCurrentTeam(teamId);
    loadTeams();
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

  return (
    <aside className={styles.teambar}>
      <div className={styles.teamList}>
        {teams.map((team) => {
          const isSelected = team.team_id === currentTeamId;
          return (
            <button
              key={team.team_id}
              className={clsx(styles.teamButton, isSelected && styles.teamButtonSelected)}
              onClick={() => handleSelectTeam(team.team_id)}
              title={team.name}
              aria-label={`Switch to ${team.name}`}
              aria-pressed={isSelected}
            >
              <div className={clsx(styles.teamAvatar, !isSelected && styles.teamAvatarInactive)}>
                {team.avatar_url ? (
                  <img src={team.avatar_url} alt={team.name} className={styles.avatarImage} />
                ) : (
                  <span className={styles.avatarInitials}>
                    {team.name ? getInitials(team.name) : <Users size={14} />}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
