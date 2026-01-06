import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { MachinesPage } from './features/machines/MachinesPage';
import { ProvidersPage } from './features/providers/ProvidersPage';
import { KeysPage } from './features/keys/KeysPage';
import { DeploymentsPage } from './features/deployments/DeploymentsPage';
import { BootstrapPage } from './features/bootstrap/BootstrapPage';
import { SettingsPage } from './features/settings/SettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/machines" replace />} />
        <Route path="machines" element={<MachinesPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="keys" element={<KeysPage />} />
        <Route path="deployments" element={<DeploymentsPage />} />
        <Route path="bootstrap" element={<BootstrapPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;



