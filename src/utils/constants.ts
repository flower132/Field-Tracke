export const USER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
]

export function getUserColor(index: number): string {
  return USER_COLORS[index % USER_COLORS.length]
}

export const LOCATION_INTERVAL = 60_000 // 60 seconds
export const TRACK_INTERVAL = 60_000 // 60 seconds
export const MAX_PHOTOS = 9
export const DEFAULT_MAP_CENTER: [number, number] = [39.9042, 116.4074] // Beijing
export const MAP_ZOOM = 12
