import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Radio,
  Users,
  Navigation,
  ChevronRight,
  Shield,
  User,
  Activity,
  Gauge,
  Signal,
  Image as ImageIcon,
  Edit3,
  Route,
  MapPin,
  ClipboardCheck,
  Map,
  CloudOff,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useLocationStore, getGpsStatus } from '../store/locationStore'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  formatTime,
} from '../utils/helpers'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { getUserColor } from '../utils/constants'
import CheckinEditModal from '../components/CheckinEditModal'
import type { Track, User as UserType, Checkin } from '../types'
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

/* ============================================================
   GPS 状态徽章
   ============================================================ */
function GpsStatusBadge({
  accuracy,
  speed,
  isTracking,
  isStationary,
}: {
  accuracy: number | null
  speed: number | null
  isTracking: boolean
  isStationary?: boolean
}) {
  const status = getGpsStatus(accuracy, speed, isTracking)

  const config = {
    acquiring: { label: '定位中', color: 'text-amber-400 bg-amber-500/10', icon: Signal },
    good: { label: '信号良好', color: 'text-emerald-400 bg-emerald-500/10', icon: Signal },
    poor: { label: '信号弱', color: 'text-rose-400 bg-rose-500/10', icon: Signal },
    static: { label: '静止', color: 'text-slate-400 bg-slate-700/30', icon: Activity },
  }

  const c = config[status]
  const Icon = c.icon

  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${c.color}`}>
      <Icon size={12} />
      {isStationary ? '静止中' : c.label}
      {accuracy !== null && (
        <span className="opacity-70">· ±{Math.round(accuracy)}m</span>
      )}
    </div>
  )
}

/* ============================================================
   打卡记录卡片（小）
   ============================================================ */
function MiniCheckinCard({
  checkin,
  onEdit,
}: {
  checkin: Checkin
  onEdit: (c: Checkin) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800/50 bg-slate-900/80 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">
        {checkin.sequence_no}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium text-slate-200">
            {checkin.title || `打卡点 #${checkin.sequence_no}`}
          </div>
          <div className="shrink-0 text-xs text-slate-500">{formatTime(checkin.created_at)}</div>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{checkin.address}</div>
        {checkin.complaint_content && (
          <div className="mt-1 truncate text-xs text-slate-400">{checkin.complaint_content}</div>
        )}
        {checkin.solution_result && (
          <div className="mt-1 truncate text-xs text-emerald-400">{checkin.solution_result}</div>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          {checkin.test_result && (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
              已处理
            </span>
          )}
          {checkin.photos && checkin.photos.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
              <ImageIcon size={10} />
              {checkin.photos.length}张
            </span>
          )}
          {checkin.edit_count && checkin.edit_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
              <Edit3 size={10} />
              已改{checkin.edit_count}次
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(checkin)
            }}
            className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400"
          >
            编辑
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- 测试人员首页 --------------------------- */
function TesterDashboard() {
  const { user } = useAuthStore()
  const { latitude, longitude, speed, accuracy, isTracking, isStationary } = useLocationStore()
  const queryClient = useQueryClient()
  const { pendingCount, syncStatus } = useOfflineSync()
  const [editingCheckin, setEditingCheckin] = useState<Checkin | null>(null)

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
      const range = getTodayRange()
      const { data } = await getCheckinsByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user,
  })

  const todayMileage = myTracks ? calculatePolylineDistance(myTracks) : 0
  const todayCheckins = myCheckins?.length || 0
  const todayComplaints =
    myCheckins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

  // 最近10条打卡
  const recentCheckins = (myCheckins || []).slice(-10).reverse()

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['checkins'] })
    setEditingCheckin(null)
  }

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
        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <Route size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{formatDistance(todayMileage)}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日轨迹里程</div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <MapPin size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{todayCheckins}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日打卡次数</div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <ClipboardCheck size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{todayComplaints}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日投诉数</div>
        </div>

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
            {latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : '位置未获取'}
          </div>
        </div>
      </div>

      {/* GPS 状态栏 */}
      {isTracking && (
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <GpsStatusBadge accuracy={accuracy} speed={speed} isTracking={isTracking} isStationary={isStationary} />
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {accuracy !== null && (
                <span className="flex items-center gap-1">
                  <Gauge size={12} />
                  精度 ±{Math.round(accuracy)}m
                </span>
              )}
              {speed !== null && (
                <span className="flex items-center gap-1">
                  <Navigation size={12} />
                  {isStationary ? '0.0' : speed.toFixed(1)} km/h
                </span>
              )}
            </div>
          </div>
          {latitude && longitude && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-600">
              <MapPin size={10} />
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </div>
          )}
        </div>
      )}

      {/* 离线缓存状态 */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <CloudOff size={18} />
            </div>
            <div>
              <div className="text-sm font-medium text-amber-400">
                {syncStatus === 'syncing' ? '同步中...' : `待同步 ${pendingCount} 条数据`}
              </div>
              <div className="text-xs text-amber-400/60">
                网络恢复后将自动上传
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 最近打卡记录 */}
      {recentCheckins.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">最近打卡</h2>
            <span className="text-xs text-slate-600">最近10条</span>
          </div>
          <div className="space-y-2">
            {recentCheckins.map((checkin) => (
              <MiniCheckinCard key={checkin.id} checkin={checkin} onEdit={setEditingCheckin} />
            ))}
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingCheckin && (
        <CheckinEditModal
          checkin={editingCheckin}
          isOpen={!!editingCheckin}
          onClose={() => setEditingCheckin(null)}
          onSaved={handleSaved}
        />
      )}
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
    const map: Record<string, (Track & { user?: UserType }) | undefined> = {}
    ;(users || []).forEach((u: UserType) => { map[u.id] = undefined })
    ;(latestTracks || []).forEach((t: Track) => {
      const existing = map[t.user_id]
      if (!existing || new Date(t.created_at) > new Date(existing.created_at)) {
        map[t.user_id] = { ...t, user: (users || []).find((u: UserType) => u.id === t.user_id) }
      }
    })
    return Object.values(map).filter(Boolean) as (Track & { user?: UserType })[]
  })()

  const recentComplaints = (checkins || [])
    .filter((c) => c.complaint_content && c.complaint_content.trim())
    .slice(-5)
    .reverse()

  const recentCheckinsAll = (checkins || []).slice(-5).reverse()

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

        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <ClipboardCheck size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{totalComplaints}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日投诉数</div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <MapPin size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{totalCheckins}</div>
          <div className="mt-0.5 text-xs text-slate-500">今日打卡数</div>
        </div>

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

      {/* 实时监控快捷入口 */}
      <button
        onClick={() => navigate('/map')}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-800/50 bg-slate-900 p-4 text-left transition-colors active:bg-slate-800"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <Map size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">实时监控</div>
            <div className="text-xs text-slate-500">查看人员位置与轨迹</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-600" />
      </button>

      {/* 最近投诉记录 */}
      {recentComplaints.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">最近投诉</h2>
            <button
              onClick={() => navigate('/checkins')}
              className="flex items-center gap-0.5 text-xs text-primary-400"
            >
              查看全部 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {recentComplaints.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 rounded-xl border border-slate-800/50 bg-slate-900/80 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400 text-sm font-bold">
                  {c.sequence_no}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium text-slate-200">
                      {c.user?.name || '未知'}
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">{formatTime(c.created_at)}</div>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">{c.complaint_content}</div>
                  <div className="mt-1 text-xs text-slate-500">{c.address}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近打卡记录 */}
      {recentCheckinsAll.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">最近打卡</h2>
            <button
              onClick={() => navigate('/checkins')}
              className="flex items-center gap-0.5 text-xs text-primary-400"
            >
              查看全部 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {recentCheckinsAll.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 rounded-xl border border-slate-800/50 bg-slate-900/80 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">
                  {c.sequence_no}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium text-slate-200">
                      {c.user?.name || '未知'}
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">{formatTime(c.created_at)}</div>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">{c.address}</div>
                  {c.test_result && (
                    <span className="mt-1 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      已处理
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 人员状态列表 */}
      {users && users.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">人员状态</h2>
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900">
            {users.map((u, idx) => {
              const isOnline = u.status === 'online'
              const latestTrack = latestByUser.find((t) => t.user_id === u.id)
              return (
                <div
                  key={u.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx !== users.length - 1 ? 'border-b border-slate-800/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                        {u.name?.charAt(0) || '?'}
                      </div>
                      <div
                        className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${
                          isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{u.name}</div>
                      <div className="text-xs text-slate-500">
                        {latestTrack ? `最近更新 ${formatTime(latestTrack.created_at)}` : '暂无位置'}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isOnline ? '在线' : '离线'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
