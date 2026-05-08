import { Bell, Wifi, WifiOff } from 'lucide-react'
import { useUiStore }   from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'

export function Header({ title }: { title: string }) {
  const { liveDriverCount, activeTrips } = useUiStore()
  const user = useAuthStore((s) => s.user)

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-base font-semibold text-slate-800">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Live stats */}
        <div className="hidden sm:flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <Wifi className="h-3.5 w-3.5" />
            {liveDriverCount} online
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-primary-600 font-medium">{activeTrips} active trips</span>
        </div>

        <button className="relative rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
        </button>

        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.fullName?.charAt(0) ?? 'A'}
          </div>
          <span className="hidden sm:block text-sm font-medium text-slate-700">
            {user?.fullName ?? 'Admin'}
          </span>
        </div>
      </div>
    </header>
  )
}
