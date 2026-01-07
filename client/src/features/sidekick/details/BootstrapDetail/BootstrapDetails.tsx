import { format } from 'date-fns';
import type { BootstrapProfile } from '@machina/shared';
import { SidekickPanel, SidekickSection, SidekickRow } from '../../components';
import styles from './BootstrapDetail.module.css';

interface BootstrapDetailsProps {
  profile: BootstrapProfile;
}

export function BootstrapDetails({ profile }: BootstrapDetailsProps) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="Profile ID" value={profile.profile_id} copyable />
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Name" value={profile.name} />
        <SidekickRow label="Method" value={profile.method} />
        <SidekickRow label="System Profile" value={profile.is_system_profile ? 'Yes' : 'No'} />
      </SidekickSection>

      {profile.services_to_run.length > 0 && (
        <SidekickSection title="Services Configuration">
          {profile.services_to_run.map((service, idx) => (
            <SidekickRow key={idx} label={service.display_name} value={service.service_name} />
          ))}
        </SidekickSection>
      )}

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(profile.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(profile.updated_at), 'PPpp')} />
      </SidekickSection>

      {profile.tags && profile.tags.length > 0 && (
        <SidekickSection title="Tags (Raw)">
          <div className={styles.tags}>
            {profile.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                <span className={styles.tagSimple}>{tag}</span>
              </span>
            ))}
          </div>
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
