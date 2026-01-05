import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/store/appStore';
import { MachineInspector } from '@/features/machines/MachineInspector';
import { Toasts } from '@/components/Toasts';

export function AppLayout() {
  const { selectedMachineId, setSelectedMachineId } = useAppStore();

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Primary Content Area */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>

        {/* Inspector Panel (I panel) */}
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

