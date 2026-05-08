import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/auth.store'

export const apiClient = axios.create({
  baseURL:        import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  timeout:        15_000,
  headers:        { 'Content-Type': 'application/json' },
})

// Attach access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh + error toast
apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<{ message?: string }>) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshed = await useAuthStore.getState().refresh()
      if (refreshed) {
        original.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`
        return apiClient(original)
      }
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(err)
    }

    const msg = err.response?.data?.message ?? err.message ?? 'Request failed'
    if (err.response?.status !== 401) toast.error(msg)
    return Promise.reject(err)
  },
)

// Typed helpers
export const get  = <T>(url: string, params?: object) =>
  apiClient.get<{ data: T }>(url, { params }).then(r => r.data.data)

export const post = <T>(url: string, data?: unknown) =>
  apiClient.post<{ data: T }>(url, data).then(r => r.data.data)

export const patch  = <T>(url: string, data?: unknown) =>
  apiClient.patch<{ data: T }>(url, data).then(r => r.data.data)

export const del = <T>(url: string) =>
  apiClient.delete<{ data: T }>(url).then(r => r.data.data)
