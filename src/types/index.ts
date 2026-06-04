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
