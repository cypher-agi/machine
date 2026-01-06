import type { MachineNetworking } from '@machina/shared';
import {
  SidekickPanel,
  SidekickSection,
  SidekickEmpty,
} from '../../Sidekick';
import styles from '../../Sidekick/Sidekick.module.css';

interface MachineNetworkingTabProps {
  networking: MachineNetworking | undefined;
}

export function MachineNetworkingTab({ networking }: MachineNetworkingTabProps) {
  if (!networking) {
    return <SidekickEmpty message="No networking information" />;
  }

  return (
    <SidekickPanel>
      {networking.open_ports?.length > 0 && (
        <SidekickSection title="Open Ports">
          <div className={styles.portsContainer}>
            {networking.open_ports.map((port: number) => (
              <span key={port} className={styles.tag}>
                <span className={styles.tagSimple}>{port}</span>
              </span>
            ))}
          </div>
        </SidekickSection>
      )}

      {networking.firewall_rules?.length > 0 && (
        <SidekickSection title="Firewall Rules">
          {networking.firewall_rules.map((rule, idx) => (
            <div key={idx} className={styles.row}>
              <span className={styles.label}>{rule.protocol.toUpperCase()} {rule.port}</span>
              <span className={styles.value}>{rule.source || '0.0.0.0/0'}</span>
            </div>
          ))}
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}

