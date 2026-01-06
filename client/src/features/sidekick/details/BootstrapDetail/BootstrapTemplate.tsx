import { Package } from 'lucide-react';
import type { BootstrapProfile } from '@machina/shared';
import {
  SidekickContentFull,
  SidekickFullCode,
  SidekickEmpty,
} from '../../components';

interface BootstrapTemplateProps {
  profile: BootstrapProfile;
}

export function BootstrapTemplate({ profile }: BootstrapTemplateProps) {
  if (!profile.cloud_init_template && !profile.ssh_bootstrap_script) {
    return <SidekickEmpty icon={<Package size={32} />} message="No template configured" />;
  }

  // Determine the content and language
  const content = profile.cloud_init_template || profile.ssh_bootstrap_script || '';
  const language = profile.cloud_init_template ? 'yaml' : 'bash';
  const title = profile.cloud_init_template ? 'Cloud-Init Template' : 'SSH Script';

  return (
    <SidekickContentFull>
      <SidekickFullCode language={language} title={title}>
        {content}
      </SidekickFullCode>
    </SidekickContentFull>
  );
}

