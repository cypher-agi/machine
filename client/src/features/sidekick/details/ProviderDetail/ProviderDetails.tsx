import { format } from 'date-fns';
import type { ProviderAccount } from '@machina/shared';
import {
  SidekickPanel,
  SidekickSection,
  SidekickRow,
} from '../../components';

export interface ProviderDetailsProps {
  account: ProviderAccount;
}

export function ProviderDetails({ account }: ProviderDetailsProps) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="Provider Account ID" value={account.provider_account_id} copyable />
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Label" value={account.label} />
        <SidekickRow label="Provider Type" value={account.provider_type} />
        <SidekickRow label="Credential Status" value={account.credential_status} />
      </SidekickSection>

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(account.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(account.updated_at), 'PPpp')} />
        {account.last_verified_at && (
          <SidekickRow label="Last Verified" value={format(new Date(account.last_verified_at), 'PPpp')} />
        )}
      </SidekickSection>
    </SidekickPanel>
  );
}

