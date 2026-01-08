import { format } from 'date-fns';
import { Shield, User } from 'lucide-react';
import type { TeamMemberDetail } from '@machina/shared';
import { SidekickPanel, SidekickSection, SidekickRow } from '../../components';
import clsx from 'clsx';
import styles from './MemberDetail.module.css';

interface MemberOverviewProps {
  member: TeamMemberDetail;
}

export function MemberOverview({ member }: MemberOverviewProps) {
  const joinedDate = format(new Date(member.joined_at), 'MMM d, yyyy');

  return (
    <SidekickPanel>
      <SidekickSection title="Member Info">
        <SidekickRow label="Display Name" value={member.user.display_name} />
        <SidekickRow label="Email" value={member.user.email} mono copyable />
      </SidekickSection>

      <SidekickSection title="Team Membership">
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Role</span>
            <span
              className={clsx(
                styles.roleBadge,
                member.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeMember
              )}
            >
              {member.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
              {member.role === 'admin' ? 'Admin' : 'Member'}
            </span>
          </div>
        </div>
        <SidekickRow label="Joined" value={joinedDate} />
        {member.invited_by_user && (
          <SidekickRow label="Invited By" value={member.invited_by_user.display_name} />
        )}
      </SidekickSection>
    </SidekickPanel>
  );
}
