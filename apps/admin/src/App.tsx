import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import { AppLayout }  from '@/components/layout/AppLayout'
import { Login }      from '@/pages/Login'
import { Dashboard }  from '@/pages/Dashboard'
import { Users }      from '@/pages/Users'
import { Drivers }    from '@/pages/Drivers'
import { Rides }      from '@/pages/Rides'
import { Payments }   from '@/pages/Payments'
import { Reports }    from '@/pages/Reports'
import { useAuthStore } from '@/store/auth.store'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   60_000,
      retry:       1,
      refetchOnWindowFocus: false,
    },
  },
})

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index     element={<Dashboard />} />
            <Route path="users"    element={<Users />}    />
            <Route path="drivers"  element={<Drivers />}  />
            <Route path="rides"    element={<Rides />}    />
            <Route path="payments" element={<Payments />} />
            <Route path="reports"  element={<Reports />}  />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: 14, borderRadius: 10, fontFamily: 'Inter, sans-serif' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
