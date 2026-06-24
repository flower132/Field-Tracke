import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TrackingMode = 'walking' | 'driving' | 'powerSave'

export interface ModeConfig {
  uploadIntervalMs: number
  minMoveDistance: number
  stationaryDistance: number
  stationarySpeed: number
  enableHighAccuracy: boolean
  label: string
}

export const MODE_CONFIGS: Record<TrackingMode, ModeConfig> = {
  walking: {
    uploadIntervalMs: 15_000,
    minMoveDistance: 5,
    stationaryDistance: 5,
    stationarySpeed: 0.5,
    enableHighAccuracy: true,
    label: '步行模式',
  },
  driving: {
    uploadIntervalMs: 5_000,
    minMoveDistance: 20,
    stationaryDistance: 30,
    stationarySpeed: 3,
    enableHighAccuracy: true,
    label: '车测模式',
  },
  powerSave: {
    uploadIntervalMs: 120_000,
    minMoveDistance: 50,
    stationaryDistance: 50,
    stationarySpeed: 1,
    enableHighAccuracy: false,
    label: '省电模式',
  },
}

interface TrackingModeState {
  mode: TrackingMode
  setMode: (mode: TrackingMode) => void
}

export const useTrackingModeStore = create<TrackingModeState>()(
  persist(
    (set) => ({
      mode: 'walking',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'tracking-mode',
    }
  )
)
