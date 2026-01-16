import { formatDistanceToNow } from 'date-fns';
import { Play, Pause, Square, Terminal } from 'lucide-react';
import type { Agent } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { Badge, Button } from '@/shared';
import { ItemCard, ItemCardMeta } from '@/shared/components';
import { AGENT_STATUS_CONFIG, AI_PROVIDER_CONFIG, EXPERTISE_CONFIG } from '../../mock';
import styles from './AgentCard.module.css';

interface AgentCardProps {
  agent: Agent;
  onStart?: (agentId: string) => void;
  onPause?: (agentId: string) => void;
  onStop?: (agentId: string) => void;
}

export function AgentCard({ agent, onStart, onPause, onStop }: AgentCardProps) {
  const { sidekickSelection, setSidekickSelection, setTerminalAgentId } = useAppStore();

  const isSelected =
    sidekickSelection?.type === 'agent' && sidekickSelection?.id === agent.agent_id;

  const status = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.error;
  const providerConfig =
    AI_PROVIDER_CONFIG[agent.reasoning_model.split('/')[0]] ||
    (agent.reasoning_model.startsWith('claude')
      ? AI_PROVIDER_CONFIG.anthropic
      : agent.reasoning_model.startsWith('gpt')
        ? AI_PROVIDER_CONFIG.openai
        : agent.reasoning_model.startsWith('gemini')
          ? AI_PROVIDER_CONFIG.google
          : AI_PROVIDER_CONFIG.local);
  const expertiseConfig = EXPERTISE_CONFIG[agent.expertise];

  const handleSelect = () => {
    // Selecting an agent opens both sidekick and terminal (handled by setSidekickSelection)
    setSidekickSelection({ type: 'agent', id: agent.agent_id });
  };

  const handleTerminal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTerminalAgentId(agent.agent_id);
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  // Get model display name (abbreviated)
  const modelName = agent.reasoning_model.split('-').slice(0, 2).join(' ');

  return (
    <ItemCard
      selected={isSelected}
      onClick={handleSelect}
      iconBadge={
        <div
          className={styles.avatarIcon}
          style={
            agent.personality.avatar_url
              ? { backgroundImage: `url(${agent.personality.avatar_url})` }
              : {}
          }
        >
          {!agent.personality.avatar_url && agent.personality.display_name.charAt(0).toUpperCase()}
        </div>
      }
      title={agent.name}
      subtitle={<span className={styles.zid}>@{agent.zid}</span>}
      statusBadge={
        <Badge variant={status.variant} {...(status.pulse && { pulse: status.pulse })}>
          {status.label}
        </Badge>
      }
      meta={
        <>
          <ItemCardMeta>
            <span className={styles.providerBadge}>{providerConfig.abbreviation}</span>
            {modelName}
          </ItemCardMeta>
          {expertiseConfig && <ItemCardMeta>{expertiseConfig.label}</ItemCardMeta>}
          {agent.last_active_at && (
            <ItemCardMeta>
              {formatDistanceToNow(new Date(agent.last_active_at), { addSuffix: true })}
            </ItemCardMeta>
          )}
        </>
      }
      actions={
        <div className={styles.actions}>
          {/* Terminal button - always visible when agent is running */}
          {agent.status === 'running' && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={handleTerminal}
              title="Open terminal"
            >
              <Terminal size={14} />
            </Button>
          )}

          {agent.status === 'stopped' || agent.status === 'error' || agent.status === 'pending' ? (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={(e) => onStart && handleAction(e, () => onStart(agent.agent_id))}
              title="Start agent"
            >
              <Play size={14} />
            </Button>
          ) : agent.status === 'running' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={(e) => onPause && handleAction(e, () => onPause(agent.agent_id))}
                title="Pause agent"
              >
                <Pause size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={(e) => onStop && handleAction(e, () => onStop(agent.agent_id))}
                title="Stop agent"
              >
                <Square size={14} />
              </Button>
            </>
          ) : agent.status === 'paused' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={(e) => onStart && handleAction(e, () => onStart(agent.agent_id))}
                title="Resume agent"
              >
                <Play size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={(e) => onStop && handleAction(e, () => onStop(agent.agent_id))}
                title="Stop agent"
              >
                <Square size={14} />
              </Button>
            </>
          ) : null}
        </div>
      }
    />
  );
}
