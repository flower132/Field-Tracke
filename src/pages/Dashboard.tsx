import { useNavigate } from 'react-router-dom'
import {
  Route,
  MapPin,
  ClipboardCheck,
  Radio,
  Users,
  Navigation,
  ChevronRight,
  Shield,
  User,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import { useQuery } from '@tanstack/react-query'
import {
  getUsers,
  getCheckins,
  getTracks,
  getTracksByUser,
  getCheckinsByUser,
  getLatestTracks,
} from '../api/supabase'
import {
  getTodayRange,
  formatDistance,
  calculatePolylineDistance,
  formatDateTime,
} from '../utils/helpers'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { getUserColor } from '../utils/constants'
import type { Track, User as UserType } from '../types'
import L from 'leaflet'

function createUserIcon(color: string) {
  return L.divIcon({
    className: 'pulse-marker',
    html: `<div style="color:${color};width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 0 2px ${color}40;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  })
}

/* --------------------------- 测试人员首页 --------------------------- */
function TesterDashboard() {
  const { user } = useAuthStore()
  const { latitude, longitude, isTracking } = useLocationStore()

  const { data: myTracks } = useQuery({
    queryKey: ['tracks', 'mine', 'today'],
    queryFn: async () => {
      if (!user) return []
      const range = getTodayRange()
      const { data } = await getTracksByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user,
  })

  const { data: myCheckins } = useQuery({
    queryKey: ['checkins', 'mine', 'today'],
    queryFn: async () => {
      if (!user) return []
      const { data } = await getCheckinsByUser(user.id)
      return data || []
    },
    enabled: !!user,
  })

  const todayMileage = myTracks ? calculatePolylineDistance(myTracks) : 0
  const todayCheckins = myCheckins?.length || 0
  const todayComplaints =
    myCheckins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

  return (
    <div className="space-y-4 p-4 pb-20">
      {/* 顶部问候 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">你好，{user?.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-400">
          <User size={12} />
          测试人员
        </div>
      </div>

      {/* 数据卡片 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 今日轨迹里程 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <Route size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{formatDistance(todayMileage)}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日轨迹里程</div>
        </div>

        {/* 今日打卡次数 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <MapPin size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{todayCheckins}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日打卡次数</div>
        </div>

        {/* 今日投诉数 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <ClipboardCheck size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{todayComplaints}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日投诉数</div>
        </div>

        {/* 当前定位状态 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div
            className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
              isTracking ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/30 text-slate-500'
            }`}
          >
            <Radio size={18} />
          </div>
          <div className={`text-2xl font-bold ${isTracking ? 'text-emerald-400' : 'text-slate-400'}`}>
            {isTracking ? '定位中' : '未开启'}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {latitude && longitude
              ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
              : '位置未获取'}
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- 管理员首页 --------------------------- */
function AdminDashboard() {
  const navigate = useNavigate()

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await getUsers()
      return data || []
    },
  })

  const { data: checkins } = useQuery({
    queryKey: ['checkins', 'today'],
    queryFn: async () => {
      const range = getTodayRange()
      const { data } = await getCheckins(range.start, range.end)
      return data || []
    },
  })

  const { data: tracks } = useQuery({
    queryKey: ['tracks', 'today'],
    queryFn: async () => {
      const range = getTodayRange()
      const { data } = await getTracks(range.start, range.end)
      return data || []
    },
  })

  const { data: latestTracks } = useQuery({
    queryKey: ['latest-tracks'],
    queryFn: async () => {
      const { data } = await getLatestTracks()
      return data || []
    },
    refetchInterval: 30000,
  })

  const onlineCount = users?.filter((u) => u.status === 'online').length || 0
  const totalCheckins = checkins?.length || 0
  const totalComplaints =
    checkins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

  const latestByUser = (() => {
    const map = new Map<string, Track & { user?: UserType }>()
    const userMap = new Map<string, UserType>()
    ;(users || []).forEach((u) => userMap.set(u.id, u))
    ;(latestTracks || []).forEach((t) => {
      const existing = map.get(t.user_id)
      if (!existing || new Date(t.created_at) > new Date(existing.created_at)) {
        map.set(t.user_id, { ...t, user: userMap.get(t.user_id) })
      }
    })
    return Array.from(map.values())
  })()

  return (
    <div className="space-y-4 p-4 pb-20">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">运营总览</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-primary-600/10 px-3 py-1 text-xs text-primary-400">
          <Shield size={12} />
          管理员
        </div>
      </div>

      {/* 统计卡片 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 在线人数 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Users size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{onlineCount}</div>
          <div className="mt-0.5 text-xs text-slate-500">在线人数</div>
          <div className="mt-2 flex -space-x-1.5">
            {(users || [])
              .filter((u) => u.status === 'online')
              .slice(0, 3)
              .map((u) => (
                <div
                  key={u.id}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[9px] text-slate-300 ring-2 ring-slate-900"
                >
                  {u.name?.charAt(0) || '?'}
                </div>
              ))}
            {onlineCount > 3 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[9px] text-slate-400 ring-2 ring-slate-900">
                +{onlineCount - 3}
              </div>
            )}
          </div>
        </div>

        {/* 今日投诉数 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <ClipboardCheck size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{totalComplaints}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日投诉数</div>
        </div>

        {/* 今日打卡数 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <MapPin size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{totalCheckins}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日打卡数</div>
        </div>

        {/* 今日总里程 */}
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <Navigation size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {formatDistance(tracks ? calculatePolylineDistance(tracks) : 0)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">今日总里程</div>
        </div>
      </div>

      {/* 实时地图预览 */}
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">实时监控</h2>
          <button
            onClick={() => navigate('/map')}
            className="flex items-center gap-0.5 text-xs text-primary-400"
          >
            查看详情 <ChevronRight size={14} />
          </button>
        </div>
        <div className="relative h-52 overflow-hidden rounded-xl">
          <MapContainer
            center={[39.9042, 116.4074]}
            zoom={11}
            className="h-full w-full"
            zoomControl={false}
            scrollWheelZoom={false}
            dragging={false}
            doubleClickZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {latestByUser.map((track, idx) => (
              <Marker
                key={track.user_id}
                position={[track.latitude, track.longitude]}
                icon={createUserIcon(getUserColor(idx))}
              >
                <Popup>
                  <div className="min-w-[140px] space-y-1 p-1">
                    <div className="font-semibold text-slate-100">{track.user?.name || '未知'}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(track.created_at)}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          {latestByUser.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm text-slate-500">
              暂无在线人员
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* --------------------------- 入口 --------------------------- */
export default function Dashboard() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  return isAdmin ? <AdminDashboard /> : <TesterDashboard />
}
