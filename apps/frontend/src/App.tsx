import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SitesPage } from './pages/SitesPage';
import { CreateSitePage } from './pages/CreateSitePage';
import { SiteDetailPage } from './pages/SiteDetailPage';
import { DeploymentLogPage } from './pages/DeploymentLogPage';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <SitesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sites/new"
            element={
              <ProtectedRoute>
                <CreateSitePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sites/:id"
            element={
              <ProtectedRoute>
                <SiteDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/deployments/:id"
            element={
              <ProtectedRoute>
                <DeploymentLogPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
