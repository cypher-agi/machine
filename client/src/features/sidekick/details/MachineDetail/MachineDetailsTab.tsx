import { format } from 'date-fns';
import type { Machine } from '@machina/shared';
import {
  SidekickPanel,
  SidekickSection,
  SidekickRow,
  SidekickJson,
} from '../../components';

interface MachineDetailsTabProps {
  machine: Machine;
}

export function MachineDetailsTab({ machine }: MachineDetailsTabProps) {
  return (
    <SidekickPanel>
      <SidekickSection title="Identifiers">
        <SidekickRow label="Machine ID" value={machine.machine_id} copyable />
        <SidekickRow label="Provider Resource ID" value={machine.provider_resource_id} copyable />
        <SidekickRow label="Terraform Workspace" value={machine.terraform_workspace} copyable />
        {machine.vpc_id && <SidekickRow label="VPC ID" value={machine.vpc_id} copyable />}
        {machine.subnet_id && <SidekickRow label="Subnet ID" value={machine.subnet_id} copyable />}
      </SidekickSection>

      <SidekickSection title="Configuration">
        <SidekickRow label="Provider" value={machine.provider} />
        <SidekickRow label="Provider Account" value={machine.provider_account_id} />
        <SidekickRow label="Region" value={machine.region} />
        {machine.zone && <SidekickRow label="Zone" value={machine.zone} />}
        <SidekickRow label="Size" value={machine.size} />
        <SidekickRow label="Image" value={machine.image} copyable />
        {machine.os_name && <SidekickRow label="OS" value={machine.os_name} />}
      </SidekickSection>

      <SidekickSection title="Network">
        <SidekickRow label="Public IP" value={machine.public_ip} copyable />
        <SidekickRow label="Private IP" value={machine.private_ip} copyable />
      </SidekickSection>

      <SidekickSection title="Status">
        <SidekickRow label="Desired Status" value={machine.desired_status} />
        <SidekickRow label="Actual Status" value={machine.actual_status} />
        <SidekickRow label="Terraform State" value={machine.terraform_state_status} />
        <SidekickRow label="Agent Status" value={machine.agent_status} />
        <SidekickRow label="Provisioning Method" value={machine.provisioning_method} />
      </SidekickSection>

      <SidekickSection title="Timestamps">
        <SidekickRow label="Created At" value={format(new Date(machine.created_at), 'PPpp')} />
        <SidekickRow label="Updated At" value={format(new Date(machine.updated_at), 'PPpp')} />
        {machine.last_health_check && (
          <SidekickRow label="Last Health Check" value={format(new Date(machine.last_health_check), 'PPpp')} />
        )}
      </SidekickSection>

      {machine.bootstrap_profile_id && (
        <SidekickSection title="Bootstrap">
          <SidekickRow label="Profile ID" value={machine.bootstrap_profile_id} copyable />
        </SidekickSection>
      )}

      {Object.keys(machine.tags).length > 0 && (
        <SidekickSection title="Tags (Raw)">
          <SidekickJson data={machine.tags} />
        </SidekickSection>
      )}
    </SidekickPanel>
  );
}

