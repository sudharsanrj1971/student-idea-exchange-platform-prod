import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore.js';
import { LoadingScreen } from './components/ui/LoadingScreen.jsx';
import ProfileRevalidator from './components/auth/ProfileRevalidator.jsx';
import GlobalNotificationListener from './components/ui/GlobalNotificationListener.jsx';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SessionPage = lazy(() => import('./pages/SessionPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const JoinPage = lazy(() => import('./pages/JoinPage.jsx'));

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user } = useAuthStore();
  const location = useLocation();
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuthStore();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";
  return user ? <Navigate to={from} replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ProfileRevalidator />
      <GlobalNotificationListener />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#12152b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#4361ee', secondary: '#fff' } },
        }}
      />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminPage /></ProtectedRoute>} />
          <Route path="/session/:sessionId" element={<ProtectedRoute><SessionPage /></ProtectedRoute>} />
          <Route path="/join/:linkCode" element={<JoinPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
