import { 
  Server, 
  Globe, 
  Clock, 
  MoreVertical,
  Info,
  RotateCcw,
  RefreshCw,
  Trash2,
  Copy
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

const providerLabels: Record<string, string> = {
  digitalocean: 'DO',
  aws: 'AWS',
  gcp: 'GCP',
  hetzner: 'HZ',
  baremetal: 'BM',
};

export function MachineCard({ machine }: MachineCardProps) {
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
      addToast({ type: 'info', title: 'Copied', message: 'IP address copied' });
    }
  };

  return (
    <div
      className={clsx(
        'group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
        'transition-colors duration-75',
        'hover:bg-cursor-surface',
        isSelected && 'bg-cursor-elevated'
      )}
      onClick={() => setSelectedMachineId(machine.machine_id)}
    >
      {/* Provider badge */}
      <div className="w-8 h-8 rounded bg-cursor-elevated border border-cursor-border flex items-center justify-center">
        <span className="text-[10px] font-mono font-medium text-text-muted">
          {providerLabels[machine.provider] || '??'}
        </span>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-text-primary truncate">
            {machine.name}
          </span>
          <span className={clsx('badge', status.class)}>
            {status.pulse && (
              <span className="w-1.5 h-1.5 rounded-full bg-current status-pulse" />
            )}
            {status.label}
          </span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Server className="w-3 h-3" />
            {machine.size}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {machine.region}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(machine.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* IP Address */}
      {machine.public_ip && (
        <div className="flex items-center gap-1">
          <code className="font-mono text-xs text-text-secondary bg-cursor-elevated px-2 py-0.5 rounded">
            {machine.public_ip}
          </code>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyIp();
            }}
            className="p-1 text-text-muted hover:text-text-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy IP"
          >
            <Copy className="w-3.5 h-3.5" />
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
            'p-1 rounded transition-colors',
            'text-text-muted hover:text-text-secondary hover:bg-cursor-surface',
            'opacity-0 group-hover:opacity-100',
            menuOpen && 'opacity-100 bg-cursor-surface'
          )}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-cursor-elevated border border-cursor-border rounded-md shadow-lg z-50 py-1 animate-fade-in">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMachineId(machine.machine_id);
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-cursor-surface hover:text-text-primary flex items-center gap-2"
            >
              <Info className="w-3.5 h-3.5" />
              Inspect
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                rebootMutation.mutate();
                setMenuOpen(false);
              }}
              disabled={machine.actual_status !== 'running'}
              className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-cursor-surface hover:text-text-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reboot
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
              disabled={machine.agent_status !== 'connected'}
              className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-cursor-surface hover:text-text-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restart Service
            </button>
            
            <hr className="my-1 border-cursor-border" />
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Destroy ${machine.name}? This cannot be undone.`)) {
                  destroyMutation.mutate();
                }
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-status-error hover:bg-status-error/10 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Destroy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
