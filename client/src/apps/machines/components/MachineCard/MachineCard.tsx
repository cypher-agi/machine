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
import type { Machine } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rebootMachine, destroyMachine } from '@/lib/api';
import { Badge, Button } from '@/shared/ui';
import { ItemCard, ItemCardMeta, ItemCardCode } from '@/shared/components';
import { PROVIDER_LABELS, MACHINE_STATUS_CONFIG } from '@/shared/constants';
import { copyToClipboard } from '@/shared/lib';
import styles from './MachineCard.module.css';

interface MachineCardProps {
  machine: Machine;
}

export function MachineCard({ machine }: MachineCardProps) {
  const { sidekickSelection, setSidekickSelection, addToast } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const isSelected = sidekickSelection?.type === 'machine' && sidekickSelection?.id === machine.machine_id;
  const status = MACHINE_STATUS_CONFIG[machine.actual_status] || MACHINE_STATUS_CONFIG.error;

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

  const copyIp = async () => {
    if (machine.public_ip) {
      await copyToClipboard(machine.public_ip);
      addToast({ type: 'info', title: 'Copied', message: 'IP address copied' });
    }
  };

  const handleSelect = () => {
    setSidekickSelection({ type: 'machine', id: machine.machine_id });
  };

  return (
    <ItemCard
      selected={isSelected}
      onClick={handleSelect}
      iconBadge={PROVIDER_LABELS[machine.provider] || '??'}
      title={machine.name}
      statusBadge={
        <Badge variant={status.variant} pulse={status.pulse}>
          {status.label}
        </Badge>
      }
      meta={
        <>
          <ItemCardMeta>
            <Server size={12} />
            {machine.size}
          </ItemCardMeta>
          <ItemCardMeta>
            <Globe size={12} />
            {machine.region}
          </ItemCardMeta>
          <ItemCardMeta>
            <Clock size={12} />
            {formatDistanceToNow(new Date(machine.created_at), { addSuffix: true })}
          </ItemCardMeta>
        </>
      }
      secondary={
        machine.public_ip && (
          <>
            <ItemCardCode>{machine.public_ip}</ItemCardCode>
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
          </>
        )
      }
      actions={
        <div className={styles.menu} ref={menuRef}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className={menuOpen ? styles.menuButtonActive : ''}
          >
            <MoreVertical size={16} />
          </Button>

          {menuOpen && (
            <div className={styles.dropdown}>
              <button
                className={styles.menuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  setSidekickSelection({ type: 'machine', id: machine.machine_id });
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
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
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
      }
      actionsAlwaysVisible
    />
  );
}
