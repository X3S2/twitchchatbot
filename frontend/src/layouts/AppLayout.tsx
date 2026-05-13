import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
import { LangToggle } from '../components/LangToggle'
import { NotificationBell } from '../components/NotificationBell'
import { LayoutDashboard, Settings, Shield, LogOut, Tv, BarChart2, Filter, Ban, Terminal, Users, BookOpen, ChevronLeft, Search, ShieldAlert } from 'lucide-react'

export default function AppLayout() {
  const { t } = useTranslation()
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Detect if we're inside a tenant detail page
  const tenantMatch = location.pathname.match(/^\/tenants\/([^/]+)/)
  const tenantId = tenantMatch ? tenantMatch[1] : null
  const inTenant = !!tenantId

  // Detect admin sub-pages
  const inAdmin = location.pathname.startsWith('/admin')

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="h-14 flex-shrink-0 px-3 md:px-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
          <img src="/favicon.svg" alt="TCB" className="w-8 h-8 flex-shrink-0" />
          <span className="hidden md:block font-bold text-sm truncate">{t('app_name')}</span>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {/* Inside a tenant → show tenant sub-nav */}
          {inTenant ? (
            <>
              <NavItem to="/tenants" icon={<ChevronLeft className="w-5 h-5" />} label={t('nav.tenants')} />
              <div className="hidden md:block px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-2">{t('nav.tenant_section')}</div>
              <NavItem to={`/tenants/${tenantId}`} icon={<LayoutDashboard className="w-5 h-5" />} label={t('nav.dashboard')} exact />
              <NavItem to={`/tenants/${tenantId}/filters/chat`} icon={<Filter className="w-5 h-5" />} label={t('nav.filters_chat')} />
              <NavItem to={`/tenants/${tenantId}/filters/name`} icon={<Filter className="w-5 h-5" />} label={t('nav.filters_name')} />
              <NavItem to={`/tenants/${tenantId}/bans`} icon={<Ban className="w-5 h-5" />} label={t('nav.bans')} />
              <NavItem to={`/tenants/${tenantId}/bans/shared`} icon={<Ban className="w-5 h-5" />} label={t('nav.shared_bans')} />
              <NavItem to={`/tenants/${tenantId}/name-scan`} icon={<ShieldAlert className="w-5 h-5" />} label={t('nav.name_scan')} />
              <NavItem to={`/tenants/${tenantId}/commands`} icon={<Terminal className="w-5 h-5" />} label={t('nav.commands')} />
              <NavItem to={`/tenants/${tenantId}/stats`} icon={<BarChart2 className="w-5 h-5" />} label={t('nav.stats')} />
              <NavItem to={`/tenants/${tenantId}/moderators`} icon={<Users className="w-5 h-5" />} label={t('nav.moderators')} />
              <NavItem to={`/tenants/${tenantId}/audit`} icon={<BookOpen className="w-5 h-5" />} label={t('nav.audit')} />
              <NavItem to={`/tenants/${tenantId}/settings`} icon={<Settings className="w-5 h-5" />} label={t('nav.settings')} />
            </>
          ) : inAdmin ? (
            <>
              <NavItem to="/" icon={<ChevronLeft className="w-5 h-5" />} label={t('nav.dashboard')} />
              <div className="hidden md:block px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-2">{t('nav.admin')}</div>
              <NavItem to="/admin" icon={<LayoutDashboard className="w-5 h-5" />} label={t('nav.dashboard')} exact />
              <NavItem to="/admin/approval" icon={<Tv className="w-5 h-5" />} label={t('admin.tenant_approval')} />
              <NavItem to="/admin/users" icon={<Users className="w-5 h-5" />} label={t('admin.user_management')} />
              <NavItem to="/admin/name-scan" icon={<Search className="w-5 h-5" />} label={t('admin.name_scan')} />
              <NavItem to="/admin/settings" icon={<Settings className="w-5 h-5" />} label={t('nav.settings')} />
              <NavItem to="/admin/legal" icon={<BookOpen className="w-5 h-5" />} label={t('admin.legal_pages')} />
            </>
          ) : (
            <>
              <NavItem to="/" icon={<LayoutDashboard className="w-5 h-5" />} label={t('nav.dashboard')} exact />
              <NavItem to="/tenants" icon={<Tv className="w-5 h-5" />} label={t('nav.tenants')} />
              <NavItem to="/users/search" icon={<Search className="w-5 h-5" />} label={t('nav.user_search')} />
              <NavItem to="/multi-ban" icon={<Ban className="w-5 h-5" />} label={t('nav.multi_ban')} />
              {isAdmin && <NavItem to="/admin" icon={<Shield className="w-5 h-5" />} label={t('nav.admin')} />}
            </>
          )}
        </nav>

        <div className="h-10 flex-shrink-0 border-t border-gray-200 dark:border-gray-800 flex items-center px-1">
          <button
            onClick={handleLogout}
            className="w-full h-full flex items-center gap-3 px-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={t('nav.logout')}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="hidden md:block">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {user && (
              <>
                {user.avatar_url && (
                  <img src={user.avatar_url} alt={user.display_name} className="w-7 h-7 rounded-full" />
                )}
                <span className="text-sm font-medium hidden sm:block">{user.display_name ?? user.twitch_username}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LangToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="h-10 flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-center gap-4 text-xs text-gray-400">
          <Link to="/legal/impressum" className="hover:text-gray-600 dark:hover:text-gray-300">{t('legal.impressum')}</Link>
          <span>·</span>
          <Link to="/legal/datenschutz" className="hover:text-gray-600 dark:hover:text-gray-300">{t('legal.datenschutz')}</Link>
        </footer>
      </div>
    </div>
  )
}

function NavItem({ to, icon, label, exact }: { to: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  const location = useLocation()
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to) && (to !== '/' || location.pathname === '/')
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
      title={label}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="hidden md:block truncate">{label}</span>
    </Link>
  )
}
