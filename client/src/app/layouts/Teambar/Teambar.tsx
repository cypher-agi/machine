import clsx from 'clsx';
import { Avatar } from '@/shared';
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
              <Avatar
                name={team.name || 'Team'}
                src={team.avatar_url}
                size="lg"
                square
                className={clsx(styles.teamAvatar, !isSelected && styles.teamAvatarInactive)}
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
