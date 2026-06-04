import { create } from 'zustand'
import type { MapLayer } from '../types'

interface MapState {
  activeLayers: MapLayer[]
  selectedUserId: string | null
  selectedDate: string
  playbackDate: string
  playbackUserId: string | null
  isPlaying: boolean
  playbackSpeed: number
  toggleLayer: (layer: MapLayer) => void
  setSelectedUserId: (id: string | null) => void
  setSelectedDate: (date: string) => void
  setPlaybackDate: (date: string) => void
  setPlaybackUserId: (id: string | null) => void
  setIsPlaying: (playing: boolean) => void
  setPlaybackSpeed: (speed: number) => void
}

export const useMapStore = create<MapState>((set) => ({
  activeLayers: ['realtime'],
  selectedUserId: null,
  selectedDate: new Date().toISOString().split('T')[0],
  playbackDate: new Date().toISOString().split('T')[0],
  playbackUserId: null,
  isPlaying: false,
  playbackSpeed: 1,
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layer)
        ? state.activeLayers.filter((l) => l !== layer)
        : [...state.activeLayers, layer],
    })),
  setSelectedUserId: (id) => set({ selectedUserId: id }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setPlaybackDate: (date) => set({ playbackDate: date }),
  setPlaybackUserId: (id) => set({ playbackUserId: id }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
}))
