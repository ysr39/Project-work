import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Users, Car, MapPin,
  CreditCard, BarChart3, LogOut, ChevronLeft, Zap,
} from 'lucide-react'
import { useUiStore }   from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users',    icon: Users,           label: 'Users'     },
  { to: '/drivers',  icon: Car,             label: 'Drivers'   },
  { to: '/rides',    icon: MapPin,          label: 'Rides'     },
  { to: '/payments', icon: CreditCard,      label: 'Payments'  },
  { to: '/reports',  icon: BarChart3,       label: 'Reports'   },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUiStore()
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside className={clsx(
      'relative flex h-screen flex-col bg-slate-900 text-white transition-all duration-300',
      sidebarOpen ? 'w-56' : 'w-16',
    )}>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-slate-800">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {sidebarOpen && (
          <span className="text-sm font-bold tracking-tight text-white">TaxiPool</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-2 py-3 space-y-0.5">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {sidebarOpen && <span>Logout</span>}
        </button>
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft className={clsx('h-4 w-4 shrink-0 transition-transform', !sidebarOpen && 'rotate-180')} />
          {sidebarOpen && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
