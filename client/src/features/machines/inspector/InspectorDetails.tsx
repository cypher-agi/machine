import { format } from 'date-fns';
import { Copy } from 'lucide-react';
import type { Machine } from '@machine/shared';
import { useAppStore } from '@/store/appStore';

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
    <div className="flex items-start justify-between py-2 border-b border-machine-border last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-primary font-mono text-right max-w-[220px] truncate" title={value || undefined}>
          {value || '—'}
        </span>
        {copyable && value && (
          <button
            onClick={handleCopy}
            className="p-1 text-text-tertiary hover:text-neon-cyan rounded transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function InspectorDetails({ machine }: InspectorDetailsProps) {
  return (
    <div className="p-4 space-y-6">
      {/* Identifiers */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Identifiers
        </h3>
        <div>
          <DetailRow label="Machine ID" value={machine.machine_id} copyable />
          <DetailRow label="Provider Resource ID" value={machine.provider_resource_id} copyable />
          <DetailRow label="Terraform Workspace" value={machine.terraform_workspace} copyable />
          {machine.vpc_id && <DetailRow label="VPC ID" value={machine.vpc_id} copyable />}
          {machine.subnet_id && <DetailRow label="Subnet ID" value={machine.subnet_id} copyable />}
        </div>
      </div>

      {/* Configuration */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Configuration
        </h3>
        <div>
          <DetailRow label="Provider" value={machine.provider} />
          <DetailRow label="Provider Account" value={machine.provider_account_id} />
          <DetailRow label="Region" value={machine.region} />
          {machine.zone && <DetailRow label="Zone" value={machine.zone} />}
          <DetailRow label="Size" value={machine.size} />
          <DetailRow label="Image" value={machine.image} copyable />
          {machine.os_name && <DetailRow label="OS" value={machine.os_name} />}
        </div>
      </div>

      {/* Network */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Network
        </h3>
        <div>
          <DetailRow label="Public IP" value={machine.public_ip} copyable />
          <DetailRow label="Private IP" value={machine.private_ip} copyable />
        </div>
      </div>

      {/* Status */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Status
        </h3>
        <div>
          <DetailRow label="Desired Status" value={machine.desired_status} />
          <DetailRow label="Actual Status" value={machine.actual_status} />
          <DetailRow label="Terraform State" value={machine.terraform_state_status} />
          <DetailRow label="Agent Status" value={machine.agent_status} />
          <DetailRow label="Provisioning Method" value={machine.provisioning_method} />
        </div>
      </div>

      {/* Timestamps */}
      <div className="card">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
          Timestamps
        </h3>
        <div>
          <DetailRow 
            label="Created At" 
            value={format(new Date(machine.created_at), 'PPpp')} 
          />
          <DetailRow 
            label="Updated At" 
            value={format(new Date(machine.updated_at), 'PPpp')} 
          />
          {machine.last_health_check && (
            <DetailRow 
              label="Last Health Check" 
              value={format(new Date(machine.last_health_check), 'PPpp')} 
            />
          )}
        </div>
      </div>

      {/* Bootstrap Profile */}
      {machine.bootstrap_profile_id && (
        <div className="card">
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
            Bootstrap
          </h3>
          <div>
            <DetailRow label="Profile ID" value={machine.bootstrap_profile_id} copyable />
          </div>
        </div>
      )}

      {/* All Tags as JSON */}
      {Object.keys(machine.tags).length > 0 && (
        <div className="card">
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
            Tags (Raw)
          </h3>
          <pre className="text-xs font-mono text-text-secondary bg-machine-elevated p-3 rounded-lg overflow-auto max-h-40">
            {JSON.stringify(machine.tags, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}




