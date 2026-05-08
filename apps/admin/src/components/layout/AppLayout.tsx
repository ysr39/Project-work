import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header  } from './Header'
import { useAdminSocket } from '@/hooks/useSocket'

const PAGE_TITLES: Record<string, string> = {
  '/':         'Dashboard',
  '/users':    'User Management',
  '/drivers':  'Driver Approvals',
  '/rides':    'Ride Monitoring',
  '/payments': 'Payments',
  '/reports':  'Reports',
}

export function AppLayout() {
  const { pathname } = useLocation()
  useAdminSocket()   // connect once at layout level

  const title = PAGE_TITLES[pathname] ?? 'Admin'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
