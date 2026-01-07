import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, ExternalLink, Shield, Building2 } from 'lucide-react';
import { getGitHubMembers } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/shared/ui';
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
          <div className={styles.memberList}>
            {membersByOrg[org].map((member) => (
              <div key={member.member_id} className={styles.memberCard}>
                <div className={styles.memberCardAvatar}>
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.login}
                      className={styles.memberCardAvatarImg}
                    />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <div className={styles.memberCardInfo}>
                  <span className={styles.memberCardName}>{member.login}</span>
                  {member.role === 'admin' && (
                    <span className={styles.memberCardRole}>
                      <Shield size={10} />
                      Admin
                    </span>
                  )}
                </div>
                <a
                  href={member.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.memberCardLink}
                  title="View GitHub profile"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
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
