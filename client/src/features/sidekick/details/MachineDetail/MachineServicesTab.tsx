import type { MachineServicesResponse } from '@machina/shared';
import {
  SidekickPanel,
  SidekickEmpty,
} from '../../components';
import styles from '../../Sidekick/Sidekick.module.css';

interface MachineServicesTabProps {
  services: MachineServicesResponse | undefined;
}

export function MachineServicesTab({ services }: MachineServicesTabProps) {
  if (!services?.services?.length) {
    return <SidekickEmpty message="No services configured" />;
  }

  return (
    <SidekickPanel>
      {services.services.map((service) => (
        <div key={service.service_name} className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>
                <span className={styles.cardName}>{service.display_name}</span>
                {service.version && (
                  <span className={styles.serviceVersion}>
                    {service.version}
                  </span>
                )}
              </div>
              <span className={styles.cardMeta}>{service.systemd_unit}</span>
            </div>
          </div>
        </div>
      ))}
    </SidekickPanel>
  );
}
