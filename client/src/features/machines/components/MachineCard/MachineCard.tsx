import { useState, useRef, useEffect } from 'react';
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
import type { Machine, MachineStatus } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rebootMachine, destroyMachine } from '@/lib/api';
import { Badge, Button } from '@/shared/ui';
import styles from './MachineCard.module.css';

interface MachineCardProps {
  machine: Machine;
}

const statusConfig: Record<MachineStatus, { label: string; variant: 'running' | 'stopped' | 'provisioning' | 'pending' | 'error'; pulse?: boolean }> = {
  running: { label: 'Running', variant: 'running', pulse: true },
  stopped: { label: 'Stopped', variant: 'stopped' },
  provisioning: { label: 'Provisioning', variant: 'provisioning', pulse: true },
  pending: { label: 'Pending', variant: 'pending', pulse: true },
  stopping: { label: 'Stopping', variant: 'pending', pulse: true },
  rebooting: { label: 'Rebooting', variant: 'provisioning', pulse: true },
  terminating: { label: 'Terminating', variant: 'error', pulse: true },
  terminated: { label: 'Terminated', variant: 'stopped' },
  error: { label: 'Error', variant: 'error' },
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
      className={clsx(styles.card, isSelected && styles.cardSelected)}
      onClick={() => setSelectedMachineId(machine.machine_id)}
    >
      {/* Provider badge */}
      <div className={styles.providerIcon}>
        <span className={styles.providerIconText}>
          {providerLabels[machine.provider] || '??'}
        </span>
      </div>

      {/* Main info */}
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{machine.name}</span>
          <Badge variant={status.variant} pulse={status.pulse}>
            {status.label}
          </Badge>
        </div>

        <div className={styles.stats}>
          <span className={styles.stat}>
            <Server size={12} />
            {machine.size}
          </span>
          <span className={styles.stat}>
            <Globe size={12} />
            {machine.region}
          </span>
          <span className={styles.stat}>
            <Clock size={12} />
            {formatDistanceToNow(new Date(machine.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* IP Address */}
      {machine.public_ip && (
        <div className={styles.ip}>
          <code className={styles.ipCode}>{machine.public_ip}</code>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={(e) => {
              e.stopPropagation();
              copyIp();
            }}
            className={styles.copyButton}
            title="Copy IP"
          >
            <Copy size={14} />
          </Button>
        </div>
      )}

      {/* Actions menu */}
      <div className={styles.menu} ref={menuRef}>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className={clsx(styles.menuButton, menuOpen && styles.menuButtonActive)}
        >
          <MoreVertical size={16} />
        </Button>

        {menuOpen && (
          <div className={styles.dropdown}>
            <button
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMachineId(machine.machine_id);
                setMenuOpen(false);
              }}
            >
              <Info size={14} />
              Inspect
            </button>

            <button
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                rebootMutation.mutate();
                setMenuOpen(false);
              }}
              disabled={machine.actual_status !== 'running'}
            >
              <RotateCcw size={14} />
              Reboot
            </button>

            <button
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
              disabled={machine.agent_status !== 'connected'}
            >
              <RefreshCw size={14} />
              Restart Service
            </button>

            <hr className={styles.menuDivider} />

            <button
              className={clsx(styles.menuItem, styles.menuItemDanger)}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Destroy ${machine.name}? This cannot be undone.`)) {
                  destroyMutation.mutate();
                }
                setMenuOpen(false);
              }}
            >
              <Trash2 size={14} />
              Destroy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
