import { useState } from 'react';
import { Server, Globe, Clock, Info, RotateCcw, RefreshCw, Trash2, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Machine } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import { useMachineActions } from '../../hooks';
import { Badge, Button, DropdownMenu, ConfirmModal } from '@/shared';
import type { DropdownMenuItem } from '@/shared';
import { ItemCard, ItemCardMeta, ItemCardCode } from '@/shared/components';
import { PROVIDER_LABELS, MACHINE_STATUS_CONFIG } from '@/shared/constants';
import { copyToClipboard } from '@/shared/lib';
import styles from './MachineCard.module.css';

interface MachineCardProps {
  machine: Machine;
}

export function MachineCard({ machine }: MachineCardProps) {
  const { sidekickSelection, setSidekickSelection, addToast } = useAppStore();
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);

  const { reboot, destroy, isDestroying } = useMachineActions({
    machineId: machine.machine_id,
    machineName: machine.name,
  });

  const isSelected =
    sidekickSelection?.type === 'machine' && sidekickSelection?.id === machine.machine_id;
  const status = MACHINE_STATUS_CONFIG[machine.actual_status] || MACHINE_STATUS_CONFIG.error;

  const copyIp = async () => {
    if (machine.public_ip) {
      await copyToClipboard(machine.public_ip);
      addToast({ type: 'info', title: 'Copied', message: 'IP address copied' });
    }
  };

  const handleSelect = () => {
    setSidekickSelection({ type: 'machine', id: machine.machine_id });
  };

  const handleDestroy = () => {
    destroy();
    setShowDestroyConfirm(false);
  };

  const menuItems: DropdownMenuItem[] = [
    {
      id: 'inspect',
      label: 'Inspect',
      icon: <Info size={14} />,
      onClick: () => setSidekickSelection({ type: 'machine', id: machine.machine_id }),
    },
    {
      id: 'reboot',
      label: 'Reboot',
      icon: <RotateCcw size={14} />,
      onClick: reboot,
      disabled: machine.actual_status !== 'running',
    },
    {
      id: 'restart-service',
      label: 'Restart Service',
      icon: <RefreshCw size={14} />,
      onClick: () => {},
      disabled: machine.agent_status !== 'connected',
    },
    { id: 'divider', label: '', onClick: () => {}, divider: true },
    {
      id: 'destroy',
      label: 'Destroy',
      icon: <Trash2 size={14} />,
      onClick: () => setShowDestroyConfirm(true),
      danger: true,
    },
  ];

  return (
    <>
      <ItemCard
        selected={isSelected}
        onClick={handleSelect}
        iconBadge={PROVIDER_LABELS[machine.provider] || '??'}
        title={machine.name}
        statusBadge={
          <Badge variant={status.variant} {...(status.pulse && { pulse: status.pulse })}>
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
        actions={<DropdownMenu items={menuItems} />}
        actionsAlwaysVisible
      />

      <ConfirmModal
        isOpen={showDestroyConfirm}
        onClose={() => setShowDestroyConfirm(false)}
        onConfirm={handleDestroy}
        title="Destroy Machine"
        message={
          <>
            Are you sure you want to destroy <strong>{machine.name}</strong>?
            <br />
            <span className={styles.dangerText}>This action cannot be undone.</span>
          </>
        }
        confirmLabel="Destroy"
        danger
        isLoading={isDestroying}
      />
    </>
  );
}
