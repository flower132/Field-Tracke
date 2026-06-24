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
  '#6366f1', // indigo
  '#d946ef', // fuchsia
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#22c55e', // green
  '#eab308', // yellow
]

export function getUserColor(index: number): string {
  return USER_COLORS[index % USER_COLORS.length]
}

export const MAX_PHOTOS = 9
export const DEFAULT_MAP_CENTER: [number, number] = [39.9042, 116.4074] // Beijing
export const MAP_ZOOM = 12

export const BASE_MAPS = [
  {
    key: 'osm' as const,
    name: '标准地图',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    key: 'esri' as const,
    name: '卫星影像',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  {
    key: 'topo' as const,
    name: '地形图',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
]

export const OFFLINE_DB_NAME = 'FieldTrackerDB'
export const OFFLINE_DB_VERSION = 1
export const SYNC_RETRY_MAX = 3
export const MARKER_CLUSTER_RADIUS = 80
