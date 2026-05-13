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
// Admin pages
import AdminIndex from '../pages/admin/Index'
import TenantApproval from '../pages/admin/TenantApproval'
import UserManagement from '../pages/admin/UserManagement'
import NameScan from '../pages/admin/NameScan'
import AdminSettings from '../pages/admin/AdminSettings'
// Tenant pages
import TenantList from '../pages/tenants/TenantList'
import TenantDashboard from '../pages/tenants/TenantDashboard'
import TenantSettings from '../pages/tenants/TenantSettings'
import TenantModerators from '../pages/tenants/TenantModerators'
import AuditLog from '../pages/tenants/AuditLog'
import Stats from '../pages/tenants/Stats'
// Filters
import ChatFilters from '../pages/tenants/filters/ChatFilters'
import NameFilters from '../pages/tenants/filters/NameFilters'
// Bans
import BanList from '../pages/tenants/bans/BanList'
import SharedBans from '../pages/tenants/bans/SharedBans'
// Commands
import Commands from '../pages/tenants/commands/Commands'

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

            {/* Tenant routes */}
            <Route path="tenants" element={<TenantList />} />
            <Route path="tenants/:id" element={<TenantDashboard />} />
            <Route path="tenants/:id/settings" element={<TenantSettings />} />
            <Route path="tenants/:id/moderators" element={<TenantModerators />} />
            <Route path="tenants/:id/audit" element={<AuditLog />} />
            <Route path="tenants/:id/stats" element={<Stats />} />
            <Route path="tenants/:id/filters" element={<ChatFilters />} />
            <Route path="tenants/:id/filters/chat" element={<ChatFilters />} />
            <Route path="tenants/:id/filters/name" element={<NameFilters />} />
            <Route path="tenants/:id/bans" element={<BanList />} />
            <Route path="tenants/:id/bans/shared" element={<SharedBans />} />
            <Route path="tenants/:id/commands" element={<Commands />} />

            {/* Admin routes */}
            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminIndex />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/approval"
              element={
                <ProtectedRoute requireAdmin>
                  <TenantApproval />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/name-scan"
              element={
                <ProtectedRoute requireAdmin>
                  <NameScan />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/settings"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSettings />
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
