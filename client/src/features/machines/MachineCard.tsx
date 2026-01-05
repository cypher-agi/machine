import { CSSProperties } from 'react';
import { 
  Server, 
  Globe, 
  Clock, 
  MoreVertical,
  Info,
  RotateCcw,
  RefreshCw,
  Trash2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { Machine, MachineStatus } from '@machine/shared';
import { useAppStore } from '@/store/appStore';
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rebootMachine, destroyMachine } from '@/lib/api';

interface MachineCardProps {
  machine: Machine;
  style?: CSSProperties;
}

const statusConfig: Record<MachineStatus, { label: string; class: string; pulse?: boolean }> = {
  running: { label: 'Running', class: 'badge-running', pulse: true },
  stopped: { label: 'Stopped', class: 'badge-stopped' },
  provisioning: { label: 'Provisioning', class: 'badge-provisioning', pulse: true },
  pending: { label: 'Pending', class: 'badge-pending', pulse: true },
  stopping: { label: 'Stopping', class: 'badge-pending', pulse: true },
  rebooting: { label: 'Rebooting', class: 'badge-provisioning', pulse: true },
  terminating: { label: 'Terminating', class: 'badge-error', pulse: true },
  terminated: { label: 'Terminated', class: 'badge-stopped' },
  error: { label: 'Error', class: 'badge-error' },
};

const providerIcons: Record<string, string> = {
  digitalocean: '🌊',
  aws: '☁️',
  gcp: '🔷',
  hetzner: '🏢',
  baremetal: '🖥️',
};

export function MachineCard({ machine, style }: MachineCardProps) {
  const { selectedMachineId, setSelectedMachineId, addToast } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const isSelected = selectedMachineId === machine.machine_id;
  const status = statusConfig[machine.actual_status] || statusConfig.error;

  const rebootMutation = useMutation({
    mutationFn: () => rebootMachine(machine.machine_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      addToast({ type: 'success', title: 'Reboot initiated', message: `Rebooting ${machine.name}` });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Reboot failed', message: error.message });
    },
  });

  const destroyMutation = useMutation({
    mutationFn: () => destroyMachine(machine.machine_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      addToast({ type: 'success', title: 'Destroy initiated', message: `Destroying ${machine.name}` });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Destroy failed', message: error.message });
    },
  });

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyIp = () => {
    if (machine.public_ip) {
      navigator.clipboard.writeText(machine.public_ip);
      addToast({ type: 'info', title: 'Copied', message: 'IP address copied to clipboard' });
    }
  };

  return (
    <div
      className={clsx(
        'card group animate-slide-in-up cursor-pointer transition-all duration-200',
        'hover:border-machine-border-light',
        isSelected && 'border-neon-cyan bg-neon-cyan/5'
      )}
      style={style}
      onClick={() => setSelectedMachineId(machine.machine_id)}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={clsx(
          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
          'bg-machine-elevated border border-machine-border',
          isSelected && 'border-neon-cyan/30'
        )}>
          {providerIcons[machine.provider] || '🖥️'}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-mono font-semibold text-text-primary truncate">
              {machine.name}
            </h3>
            <span className={clsx('badge', status.class)}>
              {status.pulse && (
                <span className="w-1.5 h-1.5 rounded-full bg-current status-pulse" />
              )}
              {status.label}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="font-mono">{machine.size}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-text-tertiary" />
              <span>{machine.region}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-text-tertiary" />
              <span>{formatDistanceToNow(new Date(machine.created_at), { addSuffix: true })}</span>
            </span>
          </div>
        </div>

        {/* IP Address */}
        {machine.public_ip && (
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm text-neon-cyan bg-neon-cyan/10 px-2 py-1 rounded">
              {machine.public_ip}
            </code>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyIp();
              }}
              className="p-1.5 text-text-tertiary hover:text-text-secondary rounded transition-colors"
              title="Copy IP"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Actions menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              'text-text-tertiary hover:text-text-secondary hover:bg-machine-elevated',
              menuOpen && 'bg-machine-elevated text-text-secondary'
            )}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-machine-elevated border border-machine-border rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMachineId(machine.machine_id);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-machine-surface hover:text-text-primary flex items-center gap-2"
              >
                <Info className="w-4 h-4" />
                Inspect
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  rebootMutation.mutate();
                  setMenuOpen(false);
                }}
                disabled={machine.actual_status !== 'running'}
                className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-machine-surface hover:text-text-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Reboot
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Open service restart modal
                  setMenuOpen(false);
                }}
                disabled={machine.agent_status !== 'connected'}
                className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-machine-surface hover:text-text-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Restart Service
              </button>
              
              <hr className="my-1 border-machine-border" />
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to destroy ${machine.name}? This action cannot be undone.`)) {
                    destroyMutation.mutate();
                  }
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-neon-red hover:bg-neon-red/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Destroy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {Object.keys(machine.tags).length > 0 && (
        <div className="mt-3 pt-3 border-t border-machine-border flex items-center gap-2 flex-wrap">
          {Object.entries(machine.tags).slice(0, 5).map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-text-tertiary bg-machine-elevated rounded"
            >
              <span className="text-text-secondary">{key}:</span>
              <span>{value}</span>
            </span>
          ))}
          {Object.keys(machine.tags).length > 5 && (
            <span className="text-xs text-text-tertiary">
              +{Object.keys(machine.tags).length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}



