import { useState, useMemo } from 'react';
import { Plus, Search, Filter, X, Layers, Settings } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { AgentCard, AgentFilters, CreateAgentWizard, AIProvidersModal } from './components';
import { useAgentGroups } from './hooks';
import { mockAgents } from './mock';
import { AgentTerminalPanel } from '@/features/terminal';
import { Button, Input, RefreshButton } from '@/shared/ui';
import { Page, PageEmptyState, PageList, CollapsibleGroup } from '@/shared';
import styles from './AgentsApp.module.css';

export function AgentsApp() {
  const {
    agentFilters,
    createAgentWizardOpen,
    setCreateAgentWizardOpen,
    terminalAgentId,
    setTerminalAgentId,
    addToast,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAIProviders, setShowAIProviders] = useState(false);
  const [groupByStatus, setGroupByStatus] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use mock data for Phase 1
  const [agents, setAgents] = useState<Agent[]>(mockAgents);

  // Filter agents based on current filters and search
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          agent.name.toLowerCase().includes(query) ||
          agent.zid.toLowerCase().includes(query) ||
          agent.personality.display_name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (agentFilters.status && agent.status !== agentFilters.status) {
        return false;
      }

      // Swarm filter
      if (agentFilters.swarm_id && agent.swarm_id !== agentFilters.swarm_id) {
        return false;
      }

      // Provider filter
      if (agentFilters.provider) {
        const isAnthropicModel = agent.reasoning_model.startsWith('claude');
        const isOpenAIModel = agent.reasoning_model.startsWith('gpt');
        const isGoogleModel = agent.reasoning_model.startsWith('gemini');
        const isLocalModel = agent.reasoning_model.startsWith('ollama');

        const providerMatch =
          (agentFilters.provider === 'anthropic' && isAnthropicModel) ||
          (agentFilters.provider === 'openai' && isOpenAIModel) ||
          (agentFilters.provider === 'google' && isGoogleModel) ||
          (agentFilters.provider === 'local' && isLocalModel);

        if (!providerMatch) return false;
      }

      // Has wallet filter
      if (agentFilters.has_wallet !== undefined) {
        const hasWallet = !!agent.wallet_chain;
        if (agentFilters.has_wallet !== hasWallet) return false;
      }

      return true;
    });
  }, [agents, agentFilters, searchQuery]);

  const activeFilterCount = Object.values(agentFilters).filter(
    (v) => v !== undefined && v !== ''
  ).length;

  // Group agents using the hook
  const groupedAgents = useAgentGroups(filteredAgents, groupByStatus);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsRefreshing(false);
    addToast({ type: 'success', title: 'Refreshed', message: 'Agent list updated' });
  };

  const handleStartAgent = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.agent_id === agentId ? { ...a, status: 'starting' as const } : a))
    );
    // Simulate starting
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === agentId ? { ...a, status: 'running' as const } : a))
      );
      addToast({ type: 'success', title: 'Agent started', message: 'Agent is now running' });
    }, 1000);
  };

  const handlePauseAgent = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.agent_id === agentId ? { ...a, status: 'paused' as const } : a))
    );
    addToast({ type: 'info', title: 'Agent paused', message: 'Agent has been paused' });
  };

  const handleStopAgent = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.agent_id === agentId ? { ...a, status: 'stopping' as const } : a))
    );
    // Simulate stopping
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === agentId ? { ...a, status: 'stopped' as const } : a))
      );
      addToast({ type: 'info', title: 'Agent stopped', message: 'Agent has been stopped' });
    }, 500);
  };

  return (
    <div className={styles.pageContainer}>
      {/* Main content area */}
      <div className={styles.mainArea}>
        <Page
          title="Agents"
          count={filteredAgents.length}
          isLoading={false}
          actions={
            <>
              {/* Search */}
              <div className={styles.searchContainer}>
                <Search size={14} className={styles.searchIcon} />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                  size="sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Group by status toggle */}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => setGroupByStatus(!groupByStatus)}
                className={clsx(groupByStatus && styles.headerButtonActive)}
                title={groupByStatus ? 'Grouped by status' : 'Not grouped'}
              >
                <Layers size={14} />
              </Button>

              {/* Filter toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  (showFilters || activeFilterCount > 0) && styles.headerButtonActive
                )}
              >
                <Filter size={14} />
                {activeFilterCount > 0 && (
                  <span className={styles.filterCount}>{activeFilterCount}</span>
                )}
              </Button>

              {/* AI Providers */}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => setShowAIProviders(true)}
                title="AI Providers"
              >
                <Settings size={14} />
              </Button>

              {/* Refresh */}
              <RefreshButton
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                title="Refresh agents"
              />

              {/* Create new agent */}
              <Button variant="primary" size="sm" onClick={() => setCreateAgentWizardOpen(true)}>
                <Plus size={14} />
                New Agent
              </Button>
            </>
          }
        >
          {/* Filters panel */}
          {showFilters && <AgentFilters onClose={() => setShowFilters(false)} />}

          {/* Content */}
          {groupedAgents && groupedAgents.some((g) => g.agents.length > 0) ? (
            <PageList>
              {groupedAgents.map((group) =>
                group.status && groupByStatus ? (
                  <CollapsibleGroup
                    key={group.status}
                    label={group.label}
                    count={group.agents.length}
                  >
                    {group.agents.map((agent) => (
                      <AgentCard
                        key={agent.agent_id}
                        agent={agent}
                        onStart={handleStartAgent}
                        onPause={handlePauseAgent}
                        onStop={handleStopAgent}
                      />
                    ))}
                  </CollapsibleGroup>
                ) : (
                  <div key="all">
                    {group.agents.map((agent) => (
                      <AgentCard
                        key={agent.agent_id}
                        agent={agent}
                        onStart={handleStartAgent}
                        onPause={handlePauseAgent}
                        onStop={handleStopAgent}
                      />
                    ))}
                  </div>
                )
              )}
            </PageList>
          ) : (
            <PageEmptyState
              title={searchQuery || activeFilterCount > 0 ? 'No agents found' : 'No agents yet'}
              actions={
                !searchQuery && activeFilterCount === 0 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setCreateAgentWizardOpen(true)}
                  >
                    <Plus size={14} />
                    Create Agent
                  </Button>
                ) : undefined
              }
            />
          )}
        </Page>
      </div>

      {/* Create Agent Wizard Modal */}
      {createAgentWizardOpen && (
        <CreateAgentWizard onClose={() => setCreateAgentWizardOpen(false)} />
      )}

      {/* AI Providers Modal */}
      {showAIProviders && <AIProvidersModal onClose={() => setShowAIProviders(false)} />}

      {/* Agent Terminal Panel */}
      {terminalAgentId && (
        <AgentTerminalPanel agentId={terminalAgentId} onClose={() => setTerminalAgentId(null)} />
      )}
    </div>
  );
}
