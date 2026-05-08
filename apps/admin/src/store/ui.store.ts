import { create } from 'zustand'

interface UiState {
  sidebarOpen:  boolean
  toggleSidebar: () => void
  setSidebar:   (open: boolean) => void

  liveDriverCount: number
  activeTrips:     number
  setLiveStats:    (drivers: number, trips: number) => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen:  true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar:   (open) => set({ sidebarOpen: open }),

  liveDriverCount: 0,
  activeTrips:     0,
  setLiveStats:   (drivers, trips) => set({ liveDriverCount: drivers, activeTrips: trips }),
}))
