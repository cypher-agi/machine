import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './app/layouts';
import styles from './App.module.css';

// Lazy-loaded route components for code-splitting
const MachinesPage = lazy(() => import('./features/machines/MachinesPage'));
const ProvidersPage = lazy(() => import('./features/providers/ProvidersPage'));
const KeysPage = lazy(() => import('./features/keys/KeysPage'));
const DeploymentsPage = lazy(() => import('./features/deployments/DeploymentsPage'));
const BootstrapPage = lazy(() => import('./features/bootstrap/BootstrapPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));

function PageLoader() {
  return (
    <div className={styles.loader}>
      <div className={styles.spinner} />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/machines" replace />} />
        <Route
          path="machines"
          element={
            <Suspense fallback={<PageLoader />}>
              <MachinesPage />
            </Suspense>
          }
        />
        <Route
          path="providers"
          element={
            <Suspense fallback={<PageLoader />}>
              <ProvidersPage />
            </Suspense>
          }
        />
        <Route
          path="keys"
          element={
            <Suspense fallback={<PageLoader />}>
              <KeysPage />
            </Suspense>
          }
        />
        <Route
          path="deployments"
          element={
            <Suspense fallback={<PageLoader />}>
              <DeploymentsPage />
            </Suspense>
          }
        />
        <Route
          path="bootstrap"
          element={
            <Suspense fallback={<PageLoader />}>
              <BootstrapPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
