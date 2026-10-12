import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header';
import HomePage from './pages/HomePage/HomePage';
import StudioShell from './components/studio/StudioShell';
import RouteMetadata from './components/RouteMetadata';

const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const UploadPage = lazy(() => import('./pages/Upload/UploadPage'));
const SolverPage = lazy(() => import('./pages/Solver/SolverPage'));
const ResultsPage = lazy(() => import('./pages/Results/ResultsPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const AnalyticsPage = lazy(() => import('./pages/Analytics/AnalyticsPage'));
const HistoryPage = lazy(() => import('./pages/History/HistoryPage'));
const LibraryPage = lazy(() => import('./pages/Library/LibraryPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const WrittenLibraryPage = lazy(() => import('./pages/WrittenLibrary/WrittenLibraryPage'));
const WrittenSetupPage = lazy(() => import('./pages/WrittenLibrary/WrittenSetupPage'));
const WrittenExamPage = lazy(() => import('./pages/WrittenExam/WrittenExamPage'));
const WrittenResultsPage = lazy(() => import('./pages/WrittenResults/WrittenResultsPage'));
const WrittenProgressPage = lazy(() => import('./pages/WrittenProgress/WrittenProgressPage'));

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '40vh',
        }}
      >
        <div className="spinner spinner-lg" />
      </div>
    );
  return isAuthenticated ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

function AppRoutes() {
  const { loading, user } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  if (loading && !isHome) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div className="spinner spinner-lg" />
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (user?.needsProfileName && !isAuthRoute) {
    return <Navigate to="/login?google=profile" replace state={{ from: location }} />;
  }

  const routes = (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<LoginPage signup />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/written-library" element={<WrittenLibraryPage />} />
      <Route path="/written-library/:paperId" element={<WrittenSetupPage />} />
      <Route path="/written/attempt/:attemptId" element={<ProtectedRoute><WrittenExamPage /></ProtectedRoute>} />
      <Route path="/written/results/:attemptId" element={<ProtectedRoute><WrittenResultsPage /></ProtectedRoute>} />
      <Route path="/written-progress" element={<ProtectedRoute><WrittenProgressPage /></ProtectedRoute>} />
      <Route path="/solve/library/:paperId" element={<SolverPage />} />
      <Route path="/solve/:paperId" element={<SolverPage />} />
      <Route path="/results/:attemptId" element={<ResultRoute />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
  const routedContent = <Suspense fallback={<div className="solver-loading"><div className="spinner spinner-lg" /><p>Opening your study space…</p></div>}>{routes}</Suspense>;
  return isHome ? (
    <>
      <Header />
      {routedContent}
    </>
  ) : isAuthRoute ? routedContent : (
    <StudioShell>{routedContent}</StudioShell>
  );
}

function ResultRoute() {
  const { attemptId } = useParams();
  return attemptId.startsWith('local-') ? (
    <ResultsPage />
  ) : (
    <ProtectedRoute>
      <ResultsPage />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteMetadata />
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
