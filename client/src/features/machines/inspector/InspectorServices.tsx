import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCw, AlertTriangle, Check, X, Loader2, Clock, Cpu, HardDrive, Play, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { MachineServicesResponse, MachineService, ServiceState, ServiceHealth } from '@machina/shared';
import { restartMachineService } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/shared/ui';
import styles from './Inspector.module.css';

interface InspectorServicesProps {
  machineId: string;
  services?: MachineServicesResponse;
}

const stateConfig: Record<ServiceState, { icon: typeof Check; className: string; bgClass: string }> = {
  running: { icon: Play, className: styles.statusSuccess, bgClass: 'rgba(74, 222, 128, 0.1)' },
  stopped: { icon: Square, className: styles.statusMuted, bgClass: 'rgba(107, 114, 128, 0.1)' },
  failed: { icon: X, className: styles.statusError, bgClass: 'rgba(248, 113, 113, 0.1)' },
  restarting: { icon: RefreshCw, className: styles.statusSuccess, bgClass: 'rgba(94, 158, 255, 0.1)' },
  unknown: { icon: AlertTriangle, className: styles.statusMuted, bgClass: 'rgba(107, 114, 128, 0.1)' },
};

const healthConfig: Record<ServiceHealth, { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: styles.statusSuccess },
  unhealthy: { label: 'Unhealthy', className: styles.statusError },
  unknown: { label: 'Unknown', className: styles.statusMuted },
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
    <div className={styles.serviceCard}>
      <div className={styles.serviceHeader}>
        <div
          className={styles.serviceIcon}
          style={{ backgroundColor: state.bgClass }}
        >
          <StateIcon
            size={20}
            className={clsx(state.className, service.state === 'restarting' && 'animate-spin')}
          />
        </div>

        <div className={styles.serviceInfo}>
          <div className={styles.serviceName}>
            <h4 className={styles.serviceTitle}>{service.display_name}</h4>
            {service.version && <span className={styles.serviceVersion}>v{service.version}</span>}
          </div>

          <p className={styles.serviceUnit}>{service.systemd_unit}</p>

          <div className={styles.serviceStats}>
            <span className={health.className}>{health.label}</span>

            {service.uptime_seconds !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <Clock size={12} />
                {formatUptime(service.uptime_seconds)}
              </span>
            )}

            {service.cpu_percent !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <Cpu size={12} />
                {service.cpu_percent.toFixed(1)}%
              </span>
            )}

            {service.memory_mb !== undefined && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <HardDrive size={12} />
                {service.memory_mb}MB
              </span>
            )}
          </div>

          {service.ports && service.ports.length > 0 && (
            <div className={styles.servicePorts}>
              <span className={styles.servicePortsLabel}>Ports:</span>
              {service.ports.map((port) => (
                <span key={port} className={styles.servicePort}>
                  {port}
                </span>
              ))}
            </div>
          )}

          {service.last_error && <div className={styles.serviceError}>{service.last_error}</div>}
        </div>

        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => restartMutation.mutate()}
          disabled={restartMutation.isPending || service.state === 'restarting'}
          title="Restart service"
        >
          {restartMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </Button>
      </div>
    </div>
  );
}

export function InspectorServices({ machineId, services }: InspectorServicesProps) {
  if (!services) {
    return (
      <div className={styles.panel}>
        <div className={clsx(styles.section, styles.emptyState)}>
          <Activity size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>Loading services...</p>
        </div>
      </div>
    );
  }

  if (!services.agent_connected) {
    return (
      <div className={styles.panel}>
        <div className={clsx(styles.section, styles.emptyState)}>
          <AlertTriangle size={32} style={{ color: 'var(--color-warning)', marginBottom: 'var(--space-2)' }} />
          <p style={{ fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
            Agent Not Connected
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: '280px' }}>
            The Machine agent is not installed or connected. Install the agent to view service status.
          </p>
        </div>
      </div>
    );
  }

  if (services.services.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={clsx(styles.section, styles.emptyState)}>
          <Activity size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No services configured</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {services.services.map((service) => (
        <ServiceCard key={service.service_name} service={service} machineId={machineId} />
      ))}

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: 'var(--space-2)' }}>
        Last updated {formatDistanceToNow(new Date(services.last_updated), { addSuffix: true })}
      </p>
    </div>
  );
}
