import { Shield, Globe, Lock, Unlock, Server } from 'lucide-react';
import clsx from 'clsx';
import type { MachineNetworking, FirewallRule, Protocol } from '@machina/shared';
import styles from './Sidekick.module.css';

interface SidekickNetworkingProps {
  networking?: MachineNetworking;
}

const protocolClassNames: Record<Protocol, string> = {
  tcp: styles.protocolTcp,
  udp: styles.protocolUdp,
  icmp: styles.protocolIcmp,
  all: '',
};

function FirewallRuleRow({ rule }: { rule: FirewallRule }) {
  const portDisplay =
    rule.port_range_start === rule.port_range_end
      ? rule.port_range_start
      : `${rule.port_range_start}-${rule.port_range_end}`;

  return (
    <div className={styles.firewallRule}>
      <div className={clsx(styles.firewallProtocol, protocolClassNames[rule.protocol])}>
        {rule.protocol}
      </div>
      <div className={styles.firewallPort}>{portDisplay}</div>
      <div className={styles.firewallDescription}>{rule.description || '—'}</div>
      <div className={styles.firewallSource}>
        {rule.source_addresses.length > 1
          ? `${rule.source_addresses.length} sources`
          : rule.source_addresses[0]}
      </div>
    </div>
  );
}

export function SidekickNetworking({ networking }: SidekickNetworkingProps) {
  if (!networking) {
    return (
      <div className={styles.panel}>
        <div className={clsx(styles.section, styles.emptyState)}>
          <Shield size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>Loading networking info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Effective Open Ports */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Globe size={12} />
          Effective Inbound Ports
        </div>
        {networking.effective_inbound_ports.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {networking.effective_inbound_ports.map((port) => (
              <span key={port} className={styles.portBadge}>
                {port}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            No inbound ports open
          </p>
        )}
      </div>

      {/* Provider Firewall Rules */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Lock size={12} />
          Provider Firewall
        </div>
        {networking.provider_firewall_rules.length > 0 ? (
          <div>
            {networking.provider_firewall_rules
              .filter((r) => r.direction === 'inbound')
              .map((rule) => (
                <FirewallRuleRow key={rule.rule_id} rule={rule} />
              ))}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            No provider firewall rules configured
          </p>
        )}
        {networking.provider_security_group_ids && networking.provider_security_group_ids.length > 0 && (
          <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Security Groups:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
              {networking.provider_security_group_ids.map((id) => (
                <code
                  key={id}
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg)',
                    padding: '1px var(--space-1)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {id}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Host Firewall Rules */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Server size={12} />
          Host Firewall
          {networking.host_firewall_type && (
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                padding: '1px var(--space-1-5)',
                backgroundColor: 'var(--color-elevated)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {networking.host_firewall_type}
            </span>
          )}
        </div>
        {networking.host_firewall_available ? (
          networking.host_firewall_rules && networking.host_firewall_rules.length > 0 ? (
            <div>
              {networking.host_firewall_rules
                .filter((r) => r.direction === 'inbound')
                .map((rule) => (
                  <FirewallRuleRow key={rule.rule_id} rule={rule} />
                ))}
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              No host firewall rules configured
            </p>
          )
        ) : (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            <p>Requires agent to be installed and connected.</p>
            <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
              Deploy with a bootstrap profile to install the agent.
            </p>
          </div>
        )}
      </div>

      {/* Open Ports (from agent) */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Unlock size={12} />
          Listening Ports
        </div>
        {networking.open_ports_available ? (
          networking.open_ports && networking.open_ports.length > 0 ? (
            <div>
              {networking.open_ports.map((port, idx) => (
                <div key={idx} className={styles.firewallRule}>
                  <div className={clsx(styles.firewallProtocol, protocolClassNames[port.protocol])}>
                    {port.protocol}
                  </div>
                  <div className={styles.firewallPort}>{port.port}</div>
                  <div className={styles.firewallDescription}>{port.process || '—'}</div>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      padding: '1px var(--space-1-5)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor:
                        port.state === 'listening' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(250, 204, 21, 0.1)',
                      color: port.state === 'listening' ? 'var(--color-success)' : 'var(--color-warning)',
                    }}
                  >
                    {port.state}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              No listening ports detected
            </p>
          )
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Requires agent to be installed and connected.
          </p>
        )}
      </div>
    </div>
  );
}

