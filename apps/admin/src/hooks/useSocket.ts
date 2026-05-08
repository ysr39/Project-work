import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore  } from '@/store/ui.store'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000'

export function useAdminSocket(onLiveUpdate?: (data: unknown) => void) {
  const socketRef = useRef<Socket | null>(null)
  const token     = useAuthStore((s) => s.accessToken)
  const setLive   = useUiStore((s) => s.setLiveStats)

  useEffect(() => {
    if (!token) return

    const socket = io(SOCKET_URL, {
      auth:       { token },
      transports: ['websocket'],
    })

    socket.on('admin:live_update', (data: {
      event: string
      data: { onlineDrivers?: number; activeTrips?: number }
    }) => {
      if (data.data.onlineDrivers !== undefined || data.data.activeTrips !== undefined) {
        setLive(data.data.onlineDrivers ?? 0, data.data.activeTrips ?? 0)
      }
      onLiveUpdate?.(data)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return socketRef
}
