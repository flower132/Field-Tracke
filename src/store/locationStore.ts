import { create } from 'zustand'

export type GpsStatus = 'acquiring' | 'good' | 'poor' | 'static'

interface LocationState {
  latitude: number | null
  longitude: number | null
  speed: number | null
  battery: number | null
  accuracy: number | null
  lastUpdate: string | null
  isTracking: boolean
  error: string | null
  setLocation: (lat: number, lng: number, speed: number, accuracy: number) => void
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
  error: null,
  setLocation: (lat, lng, speed, accuracy) =>
    set({ latitude: lat, longitude: lng, speed, accuracy, lastUpdate: new Date().toISOString(), error: null }),
  setBattery: (battery) => set({ battery }),
  setTracking: (isTracking) => set({ isTracking }),
  setError: (error) => set({ error }),
}))

// 辅助函数：根据 accuracy 和 speed 计算GPS状态
export function getGpsStatus(accuracy: number | null, speed: number | null, isTracking: boolean): GpsStatus {
  if (!isTracking) return 'acquiring'
  if (accuracy === null) return 'acquiring'
  if (accuracy > 100) return 'poor'
  if (accuracy > 50) return 'poor'
  if (speed !== null && speed < 0.5) return 'static'
  return 'good'
}
