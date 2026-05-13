import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
import { LangToggle } from '../components/LangToggle'
import { NotificationBell } from '../components/NotificationBell'
import { LayoutDashboard, Settings, Shield, LogOut, Tv, BarChart2 } from 'lucide-react'

export default function AppLayout() {
  const { t } = useTranslation()
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-3 md:p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
          <img src="/favicon.svg" alt="TCB" className="w-8 h-8 flex-shrink-0" />
          <span className="hidden md:block font-bold text-sm truncate">{t('app_name')}</span>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <NavItem to="/" icon={<LayoutDashboard className="w-5 h-5" />} label={t('nav.dashboard')} />
          <NavItem to="/tenants" icon={<Tv className="w-5 h-5" />} label={t('nav.tenants')} />
          {isAdmin && <NavItem to="/admin" icon={<Shield className="w-5 h-5" />} label={t('nav.admin')} />}
          <NavItem to="/settings" icon={<Settings className="w-5 h-5" />} label={t('nav.settings')} />
        </nav>

        <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={label}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="hidden md:block">{label}</span>
    </Link>
  )
}
