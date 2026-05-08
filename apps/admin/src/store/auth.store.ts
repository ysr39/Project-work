import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/api/client'
import { EP } from '@/api/endpoints'

interface AdminUser {
  id:       string
  phone:    string
  fullName: string | null
  role:     string
}

interface AuthState {
  accessToken:  string | null
  refreshToken: string | null
  user:         AdminUser | null
  isLoading:    boolean

  setTokens: (access: string, refresh: string, user: AdminUser) => void
  refresh:   () => Promise<boolean>
  logout:    () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken:  null,
      refreshToken: null,
      user:         null,
      isLoading:    false,

      setTokens: (access, refresh, user) =>
        set({ accessToken: access, refreshToken: refresh, user }),

      refresh: async () => {
        const rt = get().refreshToken
        if (!rt) return false
        try {
          const res = await apiClient.post(EP.refresh, { refreshToken: rt })
          const { accessToken } = res.data.data
          set({ accessToken })
          return true
        } catch {
          set({ accessToken: null, refreshToken: null, user: null })
          return false
        }
      },

      logout: () => {
        const rt = get().refreshToken
        if (rt) apiClient.post(EP.logout, { refreshToken: rt }).catch(() => {})
        set({ accessToken: null, refreshToken: null, user: null })
      },
    }),
    {
      name:    'taxipool-admin-auth',
      partialize: (s) => ({
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
        user:         s.user,
      }),
    },
  ),
)
