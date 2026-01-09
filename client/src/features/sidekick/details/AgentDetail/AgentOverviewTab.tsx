import {
  Bot,
  Brain,
  Wallet,
  Sparkles,
  MessageSquare,
  ArrowRightLeft,
  Clock,
  GraduationCap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent } from '@machina/shared';
import {
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickGrid,
  SidekickGridItem,
} from '../../components';
import {
  mockSwarms,
  mockAIProviderAccounts,
  EXPERTISE_CONFIG,
  AI_PROVIDER_CONFIG,
} from '@/apps/agents/mock';
import styles from './AgentDetail.module.css';

interface AgentOverviewTabProps {
  agent: Agent;
}

export function AgentOverviewTab({ agent }: AgentOverviewTabProps) {
  const swarm = mockSwarms.find((s) => s.swarm_id === agent.swarm_id);
  const providerAccount = mockAIProviderAccounts.find(
    (p) => p.ai_provider_account_id === agent.ai_provider_account_id
  );
  const expertiseConfig = EXPERTISE_CONFIG[agent.expertise];
  const _providerConfig = providerAccount
    ? AI_PROVIDER_CONFIG[providerAccount.provider]
    : AI_PROVIDER_CONFIG.local;

  return (
    <SidekickPanel>
      <SidekickSection title="Identity" icon={<Bot size={12} />}>
        <SidekickRow label="Name" value={agent.name} />
        <SidekickRow label="ZID" value={`@${agent.zid}`} mono copyable />
        <SidekickRow label="Swarm" value={swarm?.name || 'Unknown'} />
      </SidekickSection>

      <SidekickSection title="Reasoning" icon={<Brain size={12} />}>
        <SidekickRow label="Provider" value={providerAccount?.label || 'Unknown'} />
        <SidekickRow label="Model" value={agent.reasoning_model} mono />
        <SidekickRow
          label="Expertise"
          value={expertiseConfig?.label || agent.expertise}
          icon={<GraduationCap size={12} />}
        />
      </SidekickSection>

      {agent.wallet_chain && (
        <SidekickSection title="Wallet" icon={<Wallet size={12} />}>
          <SidekickRow label="Chain" value={agent.wallet_chain.toUpperCase()} />
          {agent.wallet_address && (
            <SidekickRow
              label="Address"
              value={`${agent.wallet_address.slice(0, 10)}...${agent.wallet_address.slice(-8)}`}
              mono
              copyable
            />
          )}
        </SidekickSection>
      )}

      <SidekickSection title="Personality" icon={<Sparkles size={12} />}>
        <SidekickRow label="Display Name" value={agent.personality.display_name} />
        <SidekickRow label="Tone" value={agent.personality.tone} />
        {agent.personality.traits.length > 0 && (
          <div className={styles.traitsRow}>
            <span className={styles.traitsLabel}>Traits</span>
            <div className={styles.traitsList}>
              {agent.personality.traits.map((trait) => (
                <span key={trait} className={styles.traitBadge}>
                  {trait}
                </span>
              ))}
            </div>
          </div>
        )}
      </SidekickSection>

      <SidekickSection title="Stats">
        <SidekickGrid>
          <SidekickGridItem
            label="Conversations"
            value={agent.total_conversations.toString()}
            icon={<MessageSquare size={12} />}
          />
          <SidekickGridItem
            label="Transactions"
            value={agent.total_transactions.toString()}
            icon={<ArrowRightLeft size={12} />}
          />
          <SidekickGridItem
            label="Last Active"
            value={
              agent.last_active_at
                ? formatDistanceToNow(new Date(agent.last_active_at), { addSuffix: true })
                : 'Never'
            }
            icon={<Clock size={12} />}
          />
          <SidekickGridItem
            label="Created"
            value={formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}
            icon={<Clock size={12} />}
          />
        </SidekickGrid>
      </SidekickSection>

      {agent.personality.backstory && (
        <SidekickSection title="Backstory">
          <p className={styles.backstory}>{agent.personality.backstory}</p>
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
