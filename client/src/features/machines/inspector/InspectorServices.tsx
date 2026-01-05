import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Activity, 
  RefreshCw, 
  AlertTriangle,
  Check,
  X,
  Loader2,
  Clock,
  Cpu,
  HardDrive,
  Play,
  Square
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { MachineServicesResponse, MachineService, ServiceState, ServiceHealth } from '@machine/shared';
import { restartMachineService } from '@/lib/api';
import { useAppStore } from '@/store/appStore';

interface InspectorServicesProps {
  machineId: string;
  services?: MachineServicesResponse;
}

const stateConfig: Record<ServiceState, { icon: typeof Check; class: string; bgClass: string }> = {
  running: { icon: Play, class: 'text-status-running', bgClass: 'bg-status-running/10' },
  stopped: { icon: Square, class: 'text-status-stopped', bgClass: 'bg-status-stopped/10' },
  failed: { icon: X, class: 'text-status-error', bgClass: 'bg-status-error/10' },
  restarting: { icon: RefreshCw, class: 'text-status-provisioning', bgClass: 'bg-status-provisioning/10' },
  unknown: { icon: AlertTriangle, class: 'text-text-tertiary', bgClass: 'bg-machine-elevated' },
};

const healthConfig: Record<ServiceHealth, { label: string; class: string }> = {
  healthy: { label: 'Healthy', class: 'text-status-running' },
  unhealthy: { label: 'Unhealthy', class: 'text-status-error' },
  unknown: { label: 'Unknown', class: 'text-text-tertiary' },
};

function formatUptime(seconds?: number): string {
  if (!seconds) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function ServiceCard({ service, machineId }: { service: MachineService; machineId: string }) {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const state = stateConfig[service.state] || stateConfig.unknown;
  const health = healthConfig[service.health] || healthConfig.unknown;
  const StateIcon = state.icon;

  const restartMutation = useMutation({
    mutationFn: () => restartMachineService(machineId, service.service_name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine-services', machineId] });
      addToast({ type: 'success', title: 'Service restarting', message: `Restarting ${service.display_name}` });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Restart failed', message: error.message });
    },
  });

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className={clsx('p-2 rounded-lg', state.bgClass)}>
          <StateIcon className={clsx('w-5 h-5', state.class, service.state === 'restarting' && 'animate-spin')} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-text-primary">{service.display_name}</h4>
            {service.version && (
              <span className="text-xs font-mono text-text-tertiary bg-machine-elevated px-1.5 py-0.5 rounded">
                v{service.version}
              </span>
            )}
          </div>
          
          <p className="text-xs text-text-tertiary font-mono mb-2">
            {service.systemd_unit}
          </p>

          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <span className={health.class}>
              {health.label}
            </span>
            
            {service.uptime_seconds !== undefined && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatUptime(service.uptime_seconds)}
              </span>
            )}
            
            {service.cpu_percent !== undefined && (
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                {service.cpu_percent.toFixed(1)}%
              </span>
            )}
            
            {service.memory_mb !== undefined && (
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {service.memory_mb}MB
              </span>
            )}
          </div>

          {/* Ports */}
          {service.ports && service.ports.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-text-tertiary">Ports:</span>
              <div className="flex gap-1">
                {service.ports.map((port) => (
                  <span key={port} className="text-xs font-mono text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded">
                    {port}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last error */}
          {service.last_error && (
            <div className="mt-2 text-xs text-status-error bg-status-error/10 px-2 py-1 rounded">
              {service.last_error}
            </div>
          )}
        </div>

        <button
          onClick={() => restartMutation.mutate()}
          disabled={restartMutation.isPending || service.state === 'restarting'}
          className="btn btn-ghost btn-icon disabled:opacity-50"
          title="Restart service"
        >
          {restartMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export function InspectorServices({ machineId, services }: InspectorServicesProps) {
  if (!services) {
    return (
      <div className="p-4">
        <div className="card flex flex-col items-center justify-center py-8">
          <Activity className="w-8 h-8 text-text-tertiary mb-2" />
          <p className="text-text-secondary">Loading services...</p>
        </div>
      </div>
    );
  }

  if (!services.agent_connected) {
    return (
      <div className="p-4">
        <div className="card flex flex-col items-center justify-center py-8">
          <AlertTriangle className="w-8 h-8 text-status-warning mb-2" />
          <p className="text-text-primary font-medium mb-1">Agent Not Connected</p>
          <p className="text-sm text-text-secondary text-center max-w-xs">
            The Machine agent is not installed or connected. Install the agent to view service status.
          </p>
        </div>
      </div>
    );
  }

  if (services.services.length === 0) {
    return (
      <div className="p-4">
        <div className="card flex flex-col items-center justify-center py-8">
          <Activity className="w-8 h-8 text-text-tertiary mb-2" />
          <p className="text-text-secondary">No services configured</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {services.services.map((service) => (
        <ServiceCard 
          key={service.service_name} 
          service={service} 
          machineId={machineId}
        />
      ))}
      
      <p className="text-xs text-text-tertiary text-center pt-2">
        Last updated {formatDistanceToNow(new Date(services.last_updated), { addSuffix: true })}
      </p>
    </div>
  );
}



