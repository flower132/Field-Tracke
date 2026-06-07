export type UserRole = 'admin' | 'tester'

export interface User {
  id: string
  name: string
  phone: string
  role: UserRole
  status: 'online' | 'offline' | 'busy'
  color?: string
  created_at: string
}

export interface Track {
  id: string
  user_id: string
  latitude: number
  longitude: number
  speed: number
  battery: number
  created_at: string
}

export interface Checkin {
  id: string
  user_id: string
  sequence_no: number
  latitude: number
  longitude: number
  address: string
  title: string
  complaint_content: string
  test_result: string
  solution_result: string
  remark: string
  created_at: string
  edit_count?: number
  last_edited_at?: string
  last_edited_by?: string
  last_edited_by_name?: string
  photos?: Photo[]
  user?: User
}

export interface Photo {
  id: string
  checkin_id: string
  photo_url: string
  created_at: string
}

export interface LocationPayload {
  user_id: string
  latitude: number
  longitude: number
  speed: number
  battery: number
}

export interface StatsSummary {
  onlineCount: number
  totalMileage: number
  totalCheckins: number
  totalComplaints: number
}

export interface UserStats {
  user: User
  todayMileage: number
  todayOnlineMinutes: number
  todayCheckins: number
  todayComplaints: number
}

export type MapLayer = 'realtime' | 'tracks' | 'checkins' | 'heat'

export type BaseMapType = 'osm' | 'esri' | 'topo'

export type SyncStatus = 'pending' | 'syncing' | 'success' | 'failed'

export interface OfflineTask {
  id: string
  type: 'track' | 'checkin' | 'photo'
  payload: unknown
  status: SyncStatus
  retryCount: number
  createdAt: string
}

export interface MapLegendItem {
  key: string
  label: string
  color: string
  shape: 'circle' | 'line' | 'numbered'
}

export interface PeriodStats {
  mileage: number
  onlineMinutes: number
  checkins: number
  complaints: number
}
