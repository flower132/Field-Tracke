import { create } from 'zustand'

export type GpsStatus = 'acquiring' | 'excellent' | 'good' | 'fair' | 'poor'

interface LocationState {
  latitude: number | null
  longitude: number | null
  speed: number | null
  battery: number | null
  accuracy: number | null
  lastUpdate: string | null
  isTracking: boolean
  isStationary: boolean
  error: string | null
  setLocation: (lat: number, lng: number, speed: number, accuracy: number, isStationary?: boolean) => void
  setBattery: (level: number) => void
  setTracking: (tracking: boolean) => void
  setError: (error: string | null) => void
}

export const useLocationStore = create<LocationState>((set) => ({
  latitude: null,
  longitude: null,
  speed: null,
  battery: null,
  accuracy: null,
  lastUpdate: null,
  isTracking: false,
  isStationary: false,
  error: null,
  setLocation: (lat, lng, speed, accuracy, isStationary = false) =>
    set({ latitude: lat, longitude: lng, speed, accuracy, isStationary, lastUpdate: new Date().toISOString(), error: null }),
  setBattery: (battery) => set({ battery }),
  setTracking: (isTracking) => set({ isTracking }),
  setError: (error) => set({ error }),
}))

// 辅助函数：根据 accuracy 计算GPS状态
// 优秀：≤10m  良好：≤20m  一般：≤50m  较差：>50m
export function getGpsStatus(accuracy: number | null, _speed: number | null, isTracking: boolean): GpsStatus {
  if (!isTracking) return 'acquiring'
  if (accuracy === null) return 'acquiring'
  if (accuracy <= 10) return 'excellent'
  if (accuracy <= 20) return 'good'
  if (accuracy <= 50) return 'fair'
  return 'poor'
}
