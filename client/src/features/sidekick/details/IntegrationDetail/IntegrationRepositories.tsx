import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderGit2, ExternalLink, Lock, Archive } from 'lucide-react';
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  subWeeks,
  subMonths,
  isAfter,
} from 'date-fns';
import { getGitHubRepositories } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { GitHubRepository } from '@machina/shared';
import { Input } from '@/shared/ui';
import { SidekickPanel, SidekickLoading } from '../../components';
import styles from './IntegrationDetail.module.css';

// Language colors (subset of GitHub's language colors)
const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

type DateGroup =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'older';

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  older: 'Older',
};

const DATE_GROUP_ORDER: DateGroup[] = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'older',
];

function getDateGroup(dateStr: string | null | undefined): DateGroup {
  if (!dateStr) return 'older';

  const date = new Date(dateStr);
  const now = new Date();

  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'thisWeek';
  if (isAfter(date, subWeeks(now, 2)) && !isThisWeek(date, { weekStartsOn: 1 })) return 'lastWeek';
  if (isThisMonth(date)) return 'thisMonth';
  if (isAfter(date, subMonths(now, 2))) return 'lastMonth';
  return 'older';
}

export function IntegrationRepositories() {
  const { currentTeamId } = useAuthStore();
  const [search, setSearch] = useState('');

  const { data: repos, isLoading } = useQuery({
    queryKey: ['github-repos', currentTeamId, search],
    queryFn: () => getGitHubRepositories(search ? { search } : undefined),
  });

  // Group repos by date and sort within each group
  const groupedRepos = useMemo(() => {
    if (!repos) return [];

    // Sort all repos by pushed_at descending
    const sorted = [...repos].sort((a, b) => {
      const dateA = a.pushed_at ? new Date(a.pushed_at).getTime() : 0;
      const dateB = b.pushed_at ? new Date(b.pushed_at).getTime() : 0;
      return dateB - dateA;
    });

    // Group by date category
    const groups: Record<DateGroup, GitHubRepository[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      lastWeek: [],
      thisMonth: [],
      lastMonth: [],
      older: [],
    };

    for (const repo of sorted) {
      const group = getDateGroup(repo.pushed_at);
      groups[group].push(repo);
    }

    // Return only non-empty groups in order
    return DATE_GROUP_ORDER.filter((group) => groups[group].length > 0).map((group) => ({
      id: group,
      label: DATE_GROUP_LABELS[group],
      repos: groups[group],
    }));
  }, [repos]);

  const totalRepos = repos?.length ?? 0;

  if (isLoading) {
    return <SidekickLoading message="Loading repositories..." />;
  }

  if (totalRepos === 0 && !search) {
    return (
      <SidekickPanel>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No repositories synced</p>
          <p className={styles.emptyStateHint}>Click Sync to import repositories from GitHub</p>
        </div>
      </SidekickPanel>
    );
  }

  return (
    <SidekickPanel>
      <div className={styles.searchBar}>
        <Input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="sm"
        />
      </div>

      <div className={styles.listContainer}>
        {groupedRepos.map((group) => (
          <div key={group.id} className={styles.dateGroup}>
            <div className={styles.dateSeparator}>
              <span className={styles.dateSeparatorLabel}>{group.label}</span>
              <span className={styles.dateSeparatorCount}>{group.repos.length}</span>
            </div>
            <div className={styles.dateGroupRepos}>
              {group.repos.map((repo) => (
                <a
                  key={repo.repo_id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.repoItem}
                >
                  <div className={styles.repoHeader}>
                    <div className={styles.repoIcon}>
                      <FolderGit2 size={14} />
                    </div>
                    <span className={styles.repoFullName}>
                      <span className={styles.repoOrg}>{repo.full_name.split('/')[0]}</span>
                      <span className={styles.repoSlash}>/</span>
                      <span className={styles.repoName}>{repo.name}</span>
                    </span>
                    <ExternalLink size={12} className={styles.repoExternalIcon} />
                    {repo.private && (
                      <span className={`${styles.badge} ${styles.badgePrivate}`}>
                        <Lock size={10} />
                      </span>
                    )}
                    {repo.archived && (
                      <span className={`${styles.badge} ${styles.badgeArchived}`}>
                        <Archive size={10} />
                      </span>
                    )}
                  </div>
                  {repo.description && <p className={styles.repoDescription}>{repo.description}</p>}
                  <div className={styles.repoMeta}>
                    {repo.language && (
                      <span className={styles.repoMetaItem}>
                        <span
                          className={styles.languageDot}
                          style={{ backgroundColor: LANGUAGE_COLORS[repo.language] || '#8b8b8b' }}
                        />
                        {repo.language}
                      </span>
                    )}
                    {repo.pushed_at && (
                      <span className={styles.repoMetaItem}>
                        {formatDistanceToNow(new Date(repo.pushed_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}

        {groupedRepos.length === 0 && search && (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>No repositories match &quot;{search}&quot;</p>
          </div>
        )}
      </div>
    </SidekickPanel>
  );
}
