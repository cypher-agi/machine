import { format } from 'date-fns';
import { KEY_TYPE_LABELS, PROVIDER_FULL_LABELS } from '@/shared/constants';
import type { SSHKey } from '@machina/shared';
import { SidekickPanel, SidekickSection, SidekickRow } from '../../components';

interface KeyDetailsProps {
  sshKey: SSHKey;
}

export function KeyDetails({ sshKey }: KeyDetailsProps) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="SSH Key ID" value={sshKey.ssh_key_id} copyable />
        <SidekickRow label="Fingerprint" value={sshKey.fingerprint} copyable />
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Name" value={sshKey.name} />
        <SidekickRow label="Key Type" value={KEY_TYPE_LABELS[sshKey.key_type]} />
      </SidekickSection>

      <SidekickSection title="Provider Sync">
        {Object.entries(sshKey.provider_key_ids).map(([provider, id]) => (
          <SidekickRow
            key={provider}
            label={PROVIDER_FULL_LABELS[provider] || provider}
            value={id as string}
            copyable
          />
        ))}
        {Object.keys(sshKey.provider_key_ids).length === 0 && (
          <SidekickRow label="Status" value="Not synced to any provider" />
        )}
      </SidekickSection>

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(sshKey.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(sshKey.updated_at), 'PPpp')} />
      </SidekickSection>
    </SidekickPanel>
  );
}
