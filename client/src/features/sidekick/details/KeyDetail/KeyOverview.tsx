import { Clock, Fingerprint, Cloud } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { KEY_TYPE_LABELS, PROVIDER_FULL_LABELS } from '@/shared/constants';
import type { SSHKey } from '@machina/shared';
import {
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickCode,
  SidekickTags,
} from '../../components';

interface KeyOverviewProps {
  sshKey: SSHKey;
}

export function KeyOverview({ sshKey }: KeyOverviewProps) {
  const syncedProviders = Object.keys(sshKey.provider_key_ids);

  return (
    <SidekickPanel>
      <SidekickSection title="Key Information">
        <SidekickRow label="Type" value={KEY_TYPE_LABELS[sshKey.key_type]} />
        <SidekickRow
          label="Fingerprint"
          value={sshKey.fingerprint}
          icon={<Fingerprint size={12} />}
          copyable
        />
        <SidekickRow
          label="Created"
          value={formatDistanceToNow(new Date(sshKey.created_at), { addSuffix: true })}
          icon={<Clock size={12} />}
        />
      </SidekickSection>

      {syncedProviders.length > 0 && (
        <SidekickSection title="Synced To" icon={<Cloud size={12} />}>
          <SidekickTags tags={syncedProviders.map((p) => PROVIDER_FULL_LABELS[p] || p)} />
        </SidekickSection>
      )}

      <SidekickSection title="Public Key">
        <SidekickCode>{sshKey.public_key}</SidekickCode>
      </SidekickSection>
    </SidekickPanel>
  );
}
