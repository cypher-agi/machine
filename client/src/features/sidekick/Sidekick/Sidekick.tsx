import { useState, useEffect } from 'react';
import type { SidekickSelection } from '@/store/appStore';
import { Drawer } from '@cypher-agi/zui';
import styles from './Sidekick.module.css';

// Import detail views for each item type
import { MachineDetail } from '../details/MachineDetail';
import { ProviderDetail } from '../details/ProviderDetail';
import { KeyDetail } from '../details/KeyDetail';
import { DeploymentDetail } from '../details/DeploymentDetail';
import { BootstrapDetail } from '../details/BootstrapDetail';
import { TeamDetail } from '../details/TeamDetail';
import { IntegrationDetail } from '../details/IntegrationDetail';
import { MemberDetail } from '../details/MemberDetail';
import { RepositoryDetail } from '../details/RepositoryDetail';
import { CommitDetail } from '../details/CommitDetail';
import { AgentDetail } from '../details/AgentDetail';

const SIDEKICK_MIN_WIDTH = 320;
const SIDEKICK_MAX_WIDTH = 600;
const SIDEKICK_DEFAULT_WIDTH = 384;
const SIDEKICK_WIDTH_KEY = 'sidekick-width';

export interface SidekickProps {
  selection: SidekickSelection | null;
  onClose: () => void;
}

export function Sidekick({ selection, onClose }: SidekickProps) {
  const [displayedSelection, setDisplayedSelection] = useState<SidekickSelection | null>(null);
  const isOpen = !!selection;

  // Handle selection changes
  useEffect(() => {
    if (isOpen && selection) {
      setDisplayedSelection(selection);
    } else if (!isOpen) {
      // Clear selection after close animation
      const timer = setTimeout(() => {
        setDisplayedSelection(null);
      }, 200);
      return () => clearTimeout(timer);
    }
    // No cleanup needed for the first case
    return undefined;
  }, [isOpen, selection]);

  // Render the appropriate detail view based on selection type
  const renderDetailView = () => {
    if (!displayedSelection) return null;

    // Note: onMinimize is now handled by the Drawer component, so we don't pass it
    const commonProps = {
      onClose,
    };

    switch (displayedSelection.type) {
      case 'machine':
        return <MachineDetail machineId={displayedSelection.id} {...commonProps} />;
      case 'provider':
        return <ProviderDetail providerId={displayedSelection.id} {...commonProps} />;
      case 'key':
        return <KeyDetail keyId={displayedSelection.id} {...commonProps} />;
      case 'deployment':
        return <DeploymentDetail deploymentId={displayedSelection.id} {...commonProps} />;
      case 'bootstrap':
        return <BootstrapDetail profileId={displayedSelection.id} {...commonProps} />;
      case 'team':
        return <TeamDetail teamId={displayedSelection.id} {...commonProps} />;
      case 'integration':
        return <IntegrationDetail integrationId={displayedSelection.id} {...commonProps} />;
      case 'member':
        return <MemberDetail memberId={displayedSelection.id} {...commonProps} />;
      case 'repository':
        return <RepositoryDetail repositoryId={displayedSelection.id} {...commonProps} />;
      case 'commit':
        return <CommitDetail commitId={displayedSelection.id} {...commonProps} />;
      case 'agent':
        return <AgentDetail agentId={displayedSelection.id} {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <Drawer
      side="right"
      isOpen={isOpen}
      onClose={onClose}
      minSize={SIDEKICK_MIN_WIDTH}
      maxSize={SIDEKICK_MAX_WIDTH}
      defaultSize={SIDEKICK_DEFAULT_WIDTH}
      storageKey={SIDEKICK_WIDTH_KEY}
      {...(styles.sidekick ? { className: styles.sidekick } : {})}
    >
      {renderDetailView()}
    </Drawer>
  );
}
