import { format } from 'date-fns';
import { Copy } from 'lucide-react';
import type { Machine } from '@machina/shared';
import { useAppStore } from '@/store/appStore';
import styles from './Inspector.module.css';

interface InspectorDetailsProps {
  machine: Machine;
}

function DetailRow({ label, value, copyable = false }: { label: string; value?: string | null; copyable?: boolean }) {
  const { addToast } = useAppStore();

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      addToast({ type: 'info', title: 'Copied', message: `${label} copied to clipboard` });
    }
  };

  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span className={styles.value} title={value || undefined}>
          {value || '—'}
        </span>
        {copyable && value && (
          <button onClick={handleCopy} className={styles.copyButton}>
            <Copy size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function InspectorDetails({ machine }: InspectorDetailsProps) {
  return (
    <div className={styles.panel}>
      {/* Identifiers */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Identifiers</div>
        <DetailRow label="Machine ID" value={machine.machine_id} copyable />
        <DetailRow label="Provider Resource ID" value={machine.provider_resource_id} copyable />
        <DetailRow label="Terraform Workspace" value={machine.terraform_workspace} copyable />
        {machine.vpc_id && <DetailRow label="VPC ID" value={machine.vpc_id} copyable />}
        {machine.subnet_id && <DetailRow label="Subnet ID" value={machine.subnet_id} copyable />}
      </div>

      {/* Configuration */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Configuration</div>
        <DetailRow label="Provider" value={machine.provider} />
        <DetailRow label="Provider Account" value={machine.provider_account_id} />
        <DetailRow label="Region" value={machine.region} />
        {machine.zone && <DetailRow label="Zone" value={machine.zone} />}
        <DetailRow label="Size" value={machine.size} />
        <DetailRow label="Image" value={machine.image} copyable />
        {machine.os_name && <DetailRow label="OS" value={machine.os_name} />}
      </div>

      {/* Network */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Network</div>
        <DetailRow label="Public IP" value={machine.public_ip} copyable />
        <DetailRow label="Private IP" value={machine.private_ip} copyable />
      </div>

      {/* Status */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Status</div>
        <DetailRow label="Desired Status" value={machine.desired_status} />
        <DetailRow label="Actual Status" value={machine.actual_status} />
        <DetailRow label="Terraform State" value={machine.terraform_state_status} />
        <DetailRow label="Agent Status" value={machine.agent_status} />
        <DetailRow label="Provisioning Method" value={machine.provisioning_method} />
      </div>

      {/* Timestamps */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Timestamps</div>
        <DetailRow label="Created At" value={format(new Date(machine.created_at), 'PPpp')} />
        <DetailRow label="Updated At" value={format(new Date(machine.updated_at), 'PPpp')} />
        {machine.last_health_check && (
          <DetailRow label="Last Health Check" value={format(new Date(machine.last_health_check), 'PPpp')} />
        )}
      </div>

      {/* Bootstrap Profile */}
      {machine.bootstrap_profile_id && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Bootstrap</div>
          <DetailRow label="Profile ID" value={machine.bootstrap_profile_id} copyable />
        </div>
      )}

      {/* All Tags as JSON */}
      {Object.keys(machine.tags).length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Tags (Raw)</div>
          <pre className={styles.jsonPreview}>{JSON.stringify(machine.tags, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
