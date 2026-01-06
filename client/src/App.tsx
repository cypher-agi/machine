import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './app/layouts';
import { PageLoader } from '@/shared/ui';

// Lazy-loaded route components for code-splitting
const MachinesApp = lazy(() => import('./apps/machines/MachinesApp'));
const ProvidersApp = lazy(() => import('./apps/providers/ProvidersApp'));
const KeysApp = lazy(() => import('./apps/keys/KeysApp'));
const DeploymentsApp = lazy(() => import('./apps/deployments/DeploymentsApp'));
const BootstrapApp = lazy(() => import('./apps/bootstrap/BootstrapApp'));
const SettingsApp = lazy(() => import('./apps/settings/SettingsApp'));

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/machines" replace />} />
        <Route
          path="machines"
          element={
            <Suspense fallback={<PageLoader />}>
              <MachinesApp />
            </Suspense>
          }
        />
        <Route
          path="providers"
          element={
            <Suspense fallback={<PageLoader />}>
              <ProvidersApp />
            </Suspense>
          }
        />
        <Route
          path="keys"
          element={
            <Suspense fallback={<PageLoader />}>
              <KeysApp />
            </Suspense>
          }
        />
        <Route
          path="deployments"
          element={
            <Suspense fallback={<PageLoader />}>
              <DeploymentsApp />
            </Suspense>
          }
        />
        <Route
          path="bootstrap"
          element={
            <Suspense fallback={<PageLoader />}>
              <BootstrapApp />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <SettingsApp />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
