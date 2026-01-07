import { Server, Clock, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BOOTSTRAP_METHOD_LABELS } from '@/shared/constants';
import type { BootstrapProfile } from '@machina/shared';
import { SidekickPanel, SidekickSection, SidekickRow, SidekickTags } from '../../components';
import styles from './BootstrapDetail.module.css';

interface BootstrapOverviewProps {
  profile: BootstrapProfile;
  machineCount: number;
}

export function BootstrapOverview({ profile, machineCount }: BootstrapOverviewProps) {
  return (
    <SidekickPanel>
      <SidekickSection title="Configuration">
        <SidekickRow label="Method" value={BOOTSTRAP_METHOD_LABELS[profile.method]} />
        <SidekickRow label="System Profile" value={profile.is_system_profile ? 'Yes' : 'No'} />
        <SidekickRow
          label="Machines Using"
          value={machineCount.toString()}
          icon={<Server size={12} />}
        />
      </SidekickSection>

      {profile.description && (
        <SidekickSection title="Description">
          <p className={styles.description}>{profile.description}</p>
        </SidekickSection>
      )}

      {profile.services_to_run.length > 0 && (
        <SidekickSection title="Services">
          {profile.services_to_run.map((service) => (
            <div key={service.service_name} className={styles.row}>
              <span className={styles.label}>{service.display_name}</span>
              <span className={styles.value}>{service.service_name}</span>
            </div>
          ))}
        </SidekickSection>
      )}

      {profile.tags && profile.tags.length > 0 && (
        <SidekickSection title="Tags" icon={<Tag size={12} />}>
          <SidekickTags tags={profile.tags} />
        </SidekickSection>
      )}

      <SidekickSection title="Timestamps">
        <SidekickRow
          label="Created"
          value={formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
          icon={<Clock size={12} />}
        />
        <SidekickRow
          label="Updated"
          value={formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true })}
        />
      </SidekickSection>
    </SidekickPanel>
  );
}
