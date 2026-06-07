import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SyncStatus, OfflineTask } from '../types'

interface OfflineState {
  syncStatus: SyncStatus
  lastSyncAt: string | null
  offlineMode: boolean
  setSyncStatus: (status: SyncStatus) => void
  setLastSyncAt: (at: string) => void
  setOfflineMode: (mode: boolean) => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      syncStatus: 'success',
      lastSyncAt: null,
      offlineMode: false,
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
      setOfflineMode: (offlineMode) => set({ offlineMode }),
    }),
    {
      name: 'offline-store',
    }
  )
)
