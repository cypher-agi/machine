import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Building2 } from 'lucide-react';
import { getGitHubMembers } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/shared';
import { SidekickPanel, SidekickLoading, SidekickSection } from '../../components';
import styles from './IntegrationDetail.module.css';

export function IntegrationMembers() {
  const { currentTeamId } = useAuthStore();
  const [search, setSearch] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['github-members', currentTeamId, search],
    queryFn: () => getGitHubMembers(search ? { search } : undefined),
  });

  // Group members by organization
  const membersByOrg = useMemo(() => {
    if (!members) return {};
    const grouped: Record<string, typeof members> = {};
    for (const member of members) {
      const org = member.organization || 'Unknown';
      if (!grouped[org]) grouped[org] = [];
      grouped[org].push(member);
    }
    // Sort orgs alphabetically, but put Unknown last
    return Object.fromEntries(
      Object.entries(grouped).sort(([a], [b]) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return a.localeCompare(b);
      })
    );
  }, [members]);

  const orgNames = Object.keys(membersByOrg);

  if (isLoading) {
    return <SidekickLoading message="Loading members..." />;
  }

  const filteredMembers = members || [];

  if (filteredMembers.length === 0 && !search) {
    return (
      <SidekickPanel>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No members synced</p>
          <p className={styles.emptyStateHint}>
            Click Sync to import members from your GitHub organizations
          </p>
        </div>
      </SidekickPanel>
    );
  }

  return (
    <SidekickPanel>
      <div className={styles.searchBar}>
        <Input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="sm"
        />
      </div>

      {orgNames.map((org) => (
        <SidekickSection
          key={org}
          title={
            <a
              href={org !== 'Unknown' ? `https://github.com/${org}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.orgSectionTitle}
            >
              <Building2 size={12} />
              <span>{org}</span>
              <span className={styles.orgSectionCount}>{membersByOrg[org].length}</span>
            </a>
          }
        >
          <div className={styles.orgMembersList}>
            {membersByOrg[org].map((member) => (
              <a
                key={member.member_id}
                href={member.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.orgMemberItem}
              >
                <div className={styles.orgMemberAvatar}>
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.login}
                      className={styles.orgMemberAvatarImg}
                    />
                  ) : (
                    <User size={14} />
                  )}
                </div>
                <div className={styles.orgMemberInfo}>
                  <div className={styles.orgMemberName}>{member.login}</div>
                  <div className={styles.orgMemberMeta}>github.com/{member.login}</div>
                </div>
                {member.role === 'admin' && (
                  <span className={styles.orgMemberBadgeAdmin}>Admin</span>
                )}
              </a>
            ))}
          </div>
        </SidekickSection>
      ))}

      {filteredMembers.length === 0 && search && (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No members match &quot;{search}&quot;</p>
        </div>
      )}
    </SidekickPanel>
  );
}
