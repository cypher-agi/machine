import { 
  Shield, 
  Globe, 
  Lock, 
  Unlock,
  Server
} from 'lucide-react';
import clsx from 'clsx';
import type { MachineNetworking, FirewallRule, Protocol } from '@machine/shared';

interface InspectorNetworkingProps {
  networking?: MachineNetworking;
}

const protocolColors: Record<Protocol, string> = {
  tcp: 'text-neon-cyan',
  udp: 'text-neon-green',
  icmp: 'text-neon-purple',
  all: 'text-text-primary',
};

function FirewallRuleRow({ rule }: { rule: FirewallRule }) {
  const portDisplay = rule.port_range_start === rule.port_range_end
    ? rule.port_range_start
    : `${rule.port_range_start}-${rule.port_range_end}`;

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-machine-elevated rounded-lg">
      <div className={clsx('w-16 font-mono text-xs uppercase', protocolColors[rule.protocol])}>
        {rule.protocol}
      </div>
      <div className="w-20 font-mono text-sm text-text-primary">
        {portDisplay}
      </div>
      <div className="flex-1 text-sm text-text-secondary truncate">
        {rule.description || '—'}
      </div>
      <div className="text-xs text-text-tertiary">
        {rule.source_addresses.length > 1 
          ? `${rule.source_addresses.length} sources`
          : rule.source_addresses[0]}
      </div>
    </div>
  );
}

export function InspectorNetworking({ networking }: InspectorNetworkingProps) {
  if (!networking) {
    return (
      <div className="p-4">
        <div className="card flex flex-col items-center justify-center py-8">
          <Shield className="w-8 h-8 text-text-tertiary mb-2" />
          <p className="text-text-secondary">Loading networking info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Effective Open Ports */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Effective Inbound Ports
        </h3>
        {networking.effective_inbound_ports.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {networking.effective_inbound_ports.map((port) => (
              <span
                key={port}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm font-mono bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 rounded"
              >
                {port}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No inbound ports open</p>
        )}
      </div>

      {/* Provider Firewall Rules */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Provider Firewall
        </h3>
        {networking.provider_firewall_rules.length > 0 ? (
          <div className="space-y-2">
            {networking.provider_firewall_rules
              .filter(r => r.direction === 'inbound')
              .map((rule) => (
                <FirewallRuleRow key={rule.rule_id} rule={rule} />
              ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No provider firewall rules configured</p>
        )}
        {networking.provider_security_group_ids && networking.provider_security_group_ids.length > 0 && (
          <div className="mt-3 pt-3 border-t border-machine-border">
            <p className="text-xs text-text-tertiary">Security Groups:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {networking.provider_security_group_ids.map((id) => (
                <code key={id} className="text-xs font-mono text-text-secondary bg-machine-bg px-1 rounded">
                  {id}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Host Firewall Rules */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Server className="w-4 h-4" />
          Host Firewall
          {networking.host_firewall_type && (
            <span className="text-[10px] px-1.5 py-0.5 bg-machine-elevated rounded">
              {networking.host_firewall_type}
            </span>
          )}
        </h3>
        {networking.host_firewall_available ? (
          networking.host_firewall_rules && networking.host_firewall_rules.length > 0 ? (
            <div className="space-y-2">
              {networking.host_firewall_rules
                .filter(r => r.direction === 'inbound')
                .map((rule) => (
                  <FirewallRuleRow key={rule.rule_id} rule={rule} />
                ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No host firewall rules configured</p>
          )
        ) : (
          <div className="text-sm text-text-tertiary">
            <p>Requires agent to be installed and connected.</p>
            <p className="text-xs mt-1">Deploy with a bootstrap profile to install the agent.</p>
          </div>
        )}
      </div>

      {/* Open Ports (from agent) */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          <Unlock className="w-4 h-4" />
          Listening Ports
        </h3>
        {networking.open_ports_available ? (
          networking.open_ports && networking.open_ports.length > 0 ? (
            <div className="space-y-2">
              {networking.open_ports.map((port, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2 px-3 bg-machine-elevated rounded-lg">
                  <div className={clsx('w-16 font-mono text-xs uppercase', protocolColors[port.protocol])}>
                    {port.protocol}
                  </div>
                  <div className="w-16 font-mono text-sm text-text-primary">
                    {port.port}
                  </div>
                  <div className="flex-1 text-sm text-text-secondary truncate">
                    {port.process || '—'}
                  </div>
                  <div className="text-xs">
                    <span className={clsx(
                      'px-1.5 py-0.5 rounded',
                      port.state === 'listening' ? 'bg-status-running/10 text-status-running' : 'bg-status-warning/10 text-status-warning'
                    )}>
                      {port.state}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No listening ports detected</p>
          )
        ) : (
          <div className="text-sm text-text-tertiary">
            <p>Requires agent to be installed and connected.</p>
          </div>
        )}
      </div>
    </div>
  );
}



