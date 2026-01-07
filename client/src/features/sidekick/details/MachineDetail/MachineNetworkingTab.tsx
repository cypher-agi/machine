import type { MachineNetworking, OpenPort, FirewallRule } from '@machina/shared';
import { SidekickPanel, SidekickSection, SidekickEmpty } from '../../components';
import styles from './MachineDetail.module.css';

interface MachineNetworkingTabProps {
  networking: MachineNetworking | undefined;
}

function formatPortRange(rule: FirewallRule): string {
  if (rule.port_range_start === rule.port_range_end) {
    return rule.port_range_start.toString();
  }
  return `${rule.port_range_start}-${rule.port_range_end}`;
}

function formatSourceAddresses(rule: FirewallRule): string {
  if (!rule.source_addresses || rule.source_addresses.length === 0) {
    return '0.0.0.0/0';
  }
  return rule.source_addresses.join(', ');
}

export function MachineNetworkingTab({ networking }: MachineNetworkingTabProps) {
  if (!networking) {
    return <SidekickEmpty message="No networking information" />;
  }

  const hasOpenPorts = networking.open_ports && networking.open_ports.length > 0;
  const hasProviderRules =
    networking.provider_firewall_rules && networking.provider_firewall_rules.length > 0;
  const hasHostRules = networking.host_firewall_rules && networking.host_firewall_rules.length > 0;

  if (!hasOpenPorts && !hasProviderRules && !hasHostRules) {
    return <SidekickEmpty message="No networking information available" />;
  }

  return (
    <SidekickPanel>
      {hasOpenPorts && (
        <SidekickSection title="Open Ports">
          <div className={styles.portsContainer}>
            {networking.open_ports?.map((port: OpenPort) => (
              <span key={`${port.port}-${port.protocol}`} className={styles.tag}>
                <span className={styles.tagSimple}>
                  {port.port}/{port.protocol}
                </span>
              </span>
            ))}
          </div>
        </SidekickSection>
      )}

      {hasProviderRules && (
        <SidekickSection title="Provider Firewall Rules">
          {networking.provider_firewall_rules.map((rule, idx) => (
            <div key={rule.rule_id || idx} className={styles.row}>
              <span className={styles.label}>
                {rule.protocol.toUpperCase()} {formatPortRange(rule)}
              </span>
              <span className={styles.value}>{formatSourceAddresses(rule)}</span>
            </div>
          ))}
        </SidekickSection>
      )}

      {hasHostRules && (
        <SidekickSection title="Host Firewall Rules">
          {networking.host_firewall_rules?.map((rule, idx) => (
            <div key={rule.rule_id || idx} className={styles.row}>
              <span className={styles.label}>
                {rule.protocol.toUpperCase()} {formatPortRange(rule)}
              </span>
              <span className={styles.value}>{formatSourceAddresses(rule)}</span>
            </div>
          ))}
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}
