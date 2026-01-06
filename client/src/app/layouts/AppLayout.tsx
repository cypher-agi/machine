import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/store/appStore';
import { MachineInspector } from '@/features/machines/MachineInspector';
import { Toasts } from '@/shared/components/Toasts';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { selectedMachineId, setSelectedMachineId } = useAppStore();

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className={styles.main}>
        {/* Primary Content Area */}
        <div className={styles.content}>
          <Outlet />
        </div>

        {/* Inspector Panel (slides in from right) */}
        {selectedMachineId && (
          <MachineInspector
            machineId={selectedMachineId}
            onClose={() => setSelectedMachineId(null)}
          />
        )}
      </main>

      {/* Toast notifications */}
      <Toasts />
    </div>
  );
}
