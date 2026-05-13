import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../i18n'
import { CookieBanner } from '../components/CookieBanner'
import { ProtectedRoute } from '../components/ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import Setup from '../pages/Setup'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import LegalPage from '../pages/LegalPage'
import { useTheme } from '../hooks/useTheme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 2 * 60 * 1000 },
  },
})

function ThemeInit() {
  useTheme()
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeInit />
        <CookieBanner />
        <Routes>
          {/* Public */}
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/legal/:slug" element={<LegalPage />} />

          {/* Protected App Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
