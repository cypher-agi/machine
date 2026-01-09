import { Wrench, Key, Check } from 'lucide-react';
import type { Agent } from '@machina/shared';
import { SidekickPanel, SidekickSection } from '../../components';
import { mockTools } from '@/apps/agents/mock';
import styles from './AgentDetail.module.css';

interface AgentToolsTabProps {
  agent: Agent;
}

export function AgentToolsTab({ agent }: AgentToolsTabProps) {
  const enabledTools = mockTools.filter((tool) => agent.enabled_tools.includes(tool.tool_id));
  const disabledTools = mockTools.filter((tool) => !agent.enabled_tools.includes(tool.tool_id));

  // Group tools by category
  const groupByCategory = (tools: typeof mockTools) => {
    const groups: Record<string, typeof mockTools> = {};
    for (const tool of tools) {
      if (!groups[tool.category]) {
        groups[tool.category] = [];
      }
      groups[tool.category].push(tool);
    }
    return groups;
  };

  const enabledByCategory = groupByCategory(enabledTools);

  return (
    <SidekickPanel>
      {Object.keys(enabledByCategory).length > 0 ? (
        Object.entries(enabledByCategory).map(([category, tools]) => (
          <SidekickSection
            key={category}
            title={`${category.charAt(0).toUpperCase() + category.slice(1)} (${tools.length})`}
            icon={<Wrench size={12} />}
          >
            <div className={styles.toolsList}>
              {tools.map((tool) => (
                <div key={tool.tool_id} className={styles.toolItem}>
                  <div className={styles.toolIcon}>
                    <Check size={12} />
                  </div>
                  <div className={styles.toolInfo}>
                    <span className={styles.toolName}>{tool.name}</span>
                    <span className={styles.toolDesc}>{tool.description}</span>
                  </div>
                  {tool.requires_credentials && <Key size={12} className={styles.toolCredIcon} />}
                </div>
              ))}
            </div>
          </SidekickSection>
        ))
      ) : (
        <SidekickSection title="No Tools Enabled">
          <p className={styles.emptyText}>
            This agent has no tools enabled. Edit the agent to add tools.
          </p>
        </SidekickSection>
      )}

      {disabledTools.length > 0 && (
        <SidekickSection title={`Available Tools (${disabledTools.length})`}>
          <p className={styles.disabledNote}>These tools can be enabled for this agent:</p>
          <div className={styles.disabledToolsList}>
            {disabledTools.map((tool) => (
              <span key={tool.tool_id} className={styles.disabledToolBadge}>
                {tool.name}
              </span>
            ))}
          </div>
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
