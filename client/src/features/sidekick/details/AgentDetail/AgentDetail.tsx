import { useState } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { Badge, Button } from '@/shared';
import { SidekickHeader, SidekickTabs, SidekickContent, SidekickLoading } from '../../components';
import { AgentOverviewTab } from './AgentOverviewTab';
import { AgentToolsTab } from './AgentToolsTab';
import { AgentTransactionsTab } from './AgentTransactionsTab';
// Mock data for now
import { mockAgents, AGENT_STATUS_CONFIG, AI_PROVIDER_CONFIG } from '@/apps/agents/mock';

export interface AgentDetailProps {
  agentId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

type TabId = 'overview' | 'tools' | 'transactions';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tools', label: 'Tools' },
  { id: 'transactions', label: 'Transactions' },
];

export function AgentDetail({ agentId, onClose, onMinimize }: AgentDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Use mock data for Phase 1
  const agent = mockAgents.find((a) => a.agent_id === agentId);
  const isLoading = false;

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!agent) {
    return <SidekickLoading message="Agent not found" />;
  }

  const status = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.error;

  // Determine provider from model
  const providerConfig = agent.reasoning_model.startsWith('claude')
    ? AI_PROVIDER_CONFIG.anthropic
    : agent.reasoning_model.startsWith('gpt')
      ? AI_PROVIDER_CONFIG.openai
      : agent.reasoning_model.startsWith('gemini')
        ? AI_PROVIDER_CONFIG.google
        : AI_PROVIDER_CONFIG.local;

  const handleStart = () => {
    // TODO: Implement start agent
    console.log('Start agent:', agentId);
  };

  const handlePause = () => {
    // TODO: Implement pause agent
    console.log('Pause agent:', agentId);
  };

  const handleStop = () => {
    // TODO: Implement stop agent
    console.log('Stop agent:', agentId);
  };

  return (
    <>
      <SidekickHeader
        iconText={agent.personality.display_name.charAt(0).toUpperCase()}
        name={agent.name}
        subtitle={`@${agent.zid} · ${providerConfig.label}`}
        statusBadge={<Badge variant={status.variant}>{status.label}</Badge>}
        onClose={onClose}
        onMinimize={onMinimize}
        quickActions={
          <div style={{ display: 'flex', gap: '4px' }}>
            {agent.status === 'stopped' ||
            agent.status === 'error' ||
            agent.status === 'pending' ? (
              <Button variant="primary" size="sm" onClick={handleStart}>
                <Play size={14} />
                Start
              </Button>
            ) : agent.status === 'running' ? (
              <>
                <Button variant="secondary" size="sm" onClick={handlePause}>
                  <Pause size={14} />
                </Button>
                <Button variant="secondary" size="sm" onClick={handleStop}>
                  <Square size={14} />
                </Button>
              </>
            ) : agent.status === 'paused' ? (
              <>
                <Button variant="primary" size="sm" onClick={handleStart}>
                  <Play size={14} />
                  Resume
                </Button>
                <Button variant="secondary" size="sm" onClick={handleStop}>
                  <Square size={14} />
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <SidekickTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <SidekickContent>
        {activeTab === 'overview' && <AgentOverviewTab agent={agent} />}
        {activeTab === 'tools' && <AgentToolsTab agent={agent} />}
        {activeTab === 'transactions' && <AgentTransactionsTab agent={agent} />}
      </SidekickContent>
    </>
  );
}
