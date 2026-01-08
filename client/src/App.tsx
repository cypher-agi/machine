import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './app/layouts';
import { PageLoader } from '@/shared/ui';
import { LoginPage, AuthGuard } from '@/features/auth';

// Lazy-loaded route components for code-splitting
const MachinesApp = lazy(() =>
  import('./apps/machines/MachinesApp').then((m) => ({ default: m.MachinesApp }))
);
const ProvidersApp = lazy(() =>
  import('./apps/providers/ProvidersApp').then((m) => ({ default: m.ProvidersApp }))
);
const KeysApp = lazy(() => import('./apps/keys/KeysApp').then((m) => ({ default: m.KeysApp })));
const DeploymentsApp = lazy(() =>
  import('./apps/deployments/DeploymentsApp').then((m) => ({ default: m.DeploymentsApp }))
);
const BootstrapApp = lazy(() =>
  import('./apps/bootstrap/BootstrapApp').then((m) => ({ default: m.BootstrapApp }))
);
const TeamsApp = lazy(() => import('./apps/teams/TeamsApp').then((m) => ({ default: m.TeamsApp })));
const IntegrationsApp = lazy(() =>
  import('./apps/integrations/IntegrationsApp').then((m) => ({ default: m.IntegrationsApp }))
);
const MembersApp = lazy(() =>
  import('./apps/members/MembersApp').then((m) => ({ default: m.MembersApp }))
);
const RepositoriesApp = lazy(() =>
  import('./apps/repositories/RepositoriesApp').then((m) => ({ default: m.RepositoriesApp }))
);

function App() {
  return (
    <Routes>
      {/* Public route - Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes - require authentication */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
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
          path="teams"
          element={
            <Suspense fallback={<PageLoader />}>
              <TeamsApp />
            </Suspense>
          }
        />
        <Route
          path="integrations"
          element={
            <Suspense fallback={<PageLoader />}>
              <IntegrationsApp />
            </Suspense>
          }
        />
        <Route
          path="repositories"
          element={
            <Suspense fallback={<PageLoader />}>
              <RepositoriesApp />
            </Suspense>
          }
        />
        <Route
          path="members"
          element={
            <Suspense fallback={<PageLoader />}>
              <MembersApp />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
