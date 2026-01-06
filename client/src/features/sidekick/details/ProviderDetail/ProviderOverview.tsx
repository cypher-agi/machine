import { Check, X, AlertCircle, Clock, Server } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PROVIDER_FULL_LABELS } from '@/shared/constants';
import type { ProviderAccount } from '@machina/shared';
import {
  SidekickPanel,
  SidekickSection,
  SidekickRow,
} from '../../components';

export interface ProviderOverviewProps {
  account: ProviderAccount;
  machineCount: number;
}

export function ProviderOverview({ account, machineCount }: ProviderOverviewProps) {
  const StatusIcon = account.credential_status === 'valid' ? Check :
                     account.credential_status === 'invalid' ? X :
                     AlertCircle;

  return (
    <SidekickPanel>
      <SidekickSection title="Status">
        <SidekickRow 
          label="Credential Status" 
          value={account.credential_status}
          icon={<StatusIcon size={12} />}
        />
        {account.last_verified_at && (
          <SidekickRow 
            label="Last Verified" 
            value={formatDistanceToNow(new Date(account.last_verified_at), { addSuffix: true })}
          />
        )}
      </SidekickSection>

      <SidekickSection title="Usage">
        <SidekickRow 
          label="Machines" 
          value={machineCount.toString()}
          icon={<Server size={12} />}
        />
      </SidekickSection>

      <SidekickSection title="Information">
        <SidekickRow 
          label="Provider Type" 
          value={PROVIDER_FULL_LABELS[account.provider_type] || account.provider_type}
        />
        <SidekickRow 
          label="Created" 
          value={formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
          icon={<Clock size={12} />}
        />
      </SidekickSection>
    </SidekickPanel>
  );
}

