// Networking - Firewall rules and ports
export type Protocol = 'tcp' | 'udp' | 'icmp' | 'all';
export type FirewallDirection = 'inbound' | 'outbound';
export type FirewallSource = 'provider' | 'host' | 'combined';

export interface FirewallRule {
  rule_id: string;
  direction: FirewallDirection;
  protocol: Protocol;
  port_range_start: number;
  port_range_end: number;
  source_addresses: string[];
  destination_addresses?: string[];
  description?: string;
  source: FirewallSource;
}

export interface FirewallProfile {
  profile_id: string;
  name: string;
  description?: string;
  rules: FirewallRule[];
  created_at: string;
  updated_at: string;
}

export interface OpenPort {
  port: number;
  protocol: Protocol;
  process?: string;
  pid?: number;
  state: 'listening' | 'established';
  local_address: string;
  service_name?: string;
}

export interface MachineNetworking {
  machine_id: string;
  
  // Provider-level firewall
  provider_firewall_rules: FirewallRule[];
  provider_firewall_id?: string;
  provider_security_group_ids?: string[];
  
  // Host-level firewall (requires agent)
  host_firewall_rules?: FirewallRule[];
  host_firewall_type?: 'ufw' | 'nftables' | 'iptables' | 'unknown';
  host_firewall_available: boolean;
  
  // Open ports (requires agent)
  open_ports?: OpenPort[];
  open_ports_available: boolean;
  
  // Effective inbound ports (computed)
  effective_inbound_ports: number[];
  
  // Last updated
  last_updated: string;
}




