import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, MapPin, ClipboardCheck, ChevronDown, ChevronUp, Route } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getTracksByUser, getCheckinsByUser } from '../api/supabase'
import {
  getTodayRange,
  getWeekRange,
  getMonthRange,
  calculatePolylineDistance,
  calculateOnlineMinutes,
  formatDateTime,
  formatDate,
  getDayOfWeekLabel,
  groupByDay,
} from '../utils/helpers'
import PeriodOverviewCard from '../components/PeriodOverviewCard'
import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']

function createCheckinIcon(seq: number, isComplaint: boolean) {
  const bg = isComplaint ? '#ef4444' : '#f59e0b'
  const label = CIRCLED_NUMBERS[seq - 1] || seq
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:${bg};color:#fff;font-weight:700;font-size:11px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

function MiniTrackMap({
  tracks,
  checkins,
  height = 200,
}: {
  tracks: Array<{ latitude: number; longitude: number; created_at?: string }>
  checkins: Array<{ id: string; latitude: number; longitude: number; sequence_no: number; complaint_content?: string; created_at?: string }>
  height?: number
}) {
  const center = useMemo(() => {
    if (tracks.length > 0) return [tracks[0].latitude, tracks[0].longitude] as [number, number]
    if (checkins.length > 0) return [checkins[0].latitude, checkins[0].longitude] as [number, number]
    return [39.9042, 116.4074] as [number, number]
  }, [tracks, checkins])

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ height }}>
      <MapContainer
        center={center}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {tracks.length > 1 && (
          <Polyline
            positions={tracks.map((t) => [t.latitude, t.longitude])}
            color="#3b82f6"
            weight={2.5}
            opacity={0.8}
          />
        )}
        {checkins.map((c) => (
          <Marker
            key={c.id}
            position={[c.latitude, c.longitude]}
            icon={createCheckinIcon(c.sequence_no, !!c.complaint_content?.trim())}
          >
            <Popup>
              <div className="text-xs text-slate-500">
                {formatDateTime(c.created_at || '')}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {tracks.length === 0 && checkins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm text-slate-500">
          暂无轨迹数据
        </div>
      )}
    </div>
  )
}

export default function PeriodDetailPage() {
  const { period } = useParams<{ period: 'today' | 'week' | 'month' }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const dateRange = (() => {
    switch (period) {
      case 'today':
        return getTodayRange()
      case 'week':
        return getWeekRange()
      case 'month':
        return getMonthRange()
      default:
        return getTodayRange()
    }
  })()

  const { data: tracks } = useQuery({
    queryKey: ['tracks', 'period', period, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data } = await getTracksByUser(user.id, dateRange.start, dateRange.end)
      return data || []
    },
    enabled: !!user,
  })

  const { data: checkins } = useQuery({
    queryKey: ['checkins', 'period', period, user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data } = await getCheckinsByUser(user.id, dateRange.start, dateRange.end)
      return data || []
    },
    enabled: !!user,
  })

  const mileage = tracks ? calculatePolylineDistance(tracks) : 0
  const onlineMinutes = tracks ? calculateOnlineMinutes(tracks) : 0
  const totalCheckins = checkins?.length || 0
  const totalComplaints =
    checkins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

  const periodTitle = {
    today: '今日详情',
    week: '本周详情',
    month: '本月详情',
  }[period || 'today']

  const groupedByDay = groupByDay(checkins || [])
  const sortedDays = Object.keys(groupedByDay).sort().reverse()

  const tracksByDay = useMemo(() => {
    if (!tracks || tracks.length === 0) return {}
    const groups: Record<string, typeof tracks> = {}
    for (const t of tracks) {
      const day = formatDate(t.created_at)
      if (!groups[day]) groups[day] = []
      groups[day].push(t)
    }
    return groups
  }, [tracks])

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-20 pt-4">
      {/* 顶部 */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          className="rounded-lg bg-slate-800 p-2 text-slate-400"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-slate-100">{periodTitle}</h1>
      </div>

      {/* 概览卡片 */}
      <PeriodOverviewCard
        title="统计概览"
        mileage={mileage}
        onlineMinutes={onlineMinutes}
        checkins={totalCheckins}
        complaints={totalComplaints}
      />

      {/* 今日详情：轨迹地图 + 打卡列表 */}
      {period === 'today' && (
        <div className="mt-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">今日轨迹</h2>
          <MiniTrackMap tracks={tracks || []} checkins={checkins || []} height={220} />

          <h2 className="text-sm font-semibold text-slate-300">打卡记录</h2>
          {(checkins || []).length === 0 && (
            <div className="py-8 text-center text-sm text-slate-600">暂无打卡记录</div>
          )}
          {(checkins || []).map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-800/50 bg-slate-900 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
                  {c.sequence_no}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-200">{c.title || `打卡 #${c.sequence_no}`}</div>
                  <div className="text-xs text-slate-500">{c.address}</div>
                </div>
                <div className="text-xs text-slate-600">{formatDateTime(c.created_at)}</div>
              </div>
              {c.complaint_content && (
                <div className="mt-2 text-xs text-rose-400">投诉：{c.complaint_content}</div>
              )}
              {c.solution_result && (
                <div className="mt-1 text-xs text-emerald-400">处理：{c.solution_result}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 本周/本月：按天分组 */}
      {(period === 'week' || period === 'month') && (
        <div className="mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">
            {period === 'week' ? '按天查看' : '每日记录'}
          </h2>
          {sortedDays.map((day) => {
            const dayCheckins = groupedByDay[day]
            const dayComplaints = dayCheckins.filter((c) => c.complaint_content?.trim())
            const isExpanded = expandedDays.has(day)
            return (
              <div key={day} className="rounded-xl border border-slate-800/50 bg-slate-900">
                <button
                  onClick={() => toggleDay(day)}
                  className="flex w-full items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-200">
                      {day} {getDayOfWeekLabel(day)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={10} className="text-amber-400" />
                      {dayCheckins.length}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <ClipboardCheck size={10} className="text-rose-400" />
                      {dayComplaints.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-slate-500" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-500" />
                  )}
                </button>
                {isExpanded && (
                  <div className="space-y-3 border-t border-slate-800/50 px-4 py-3">
                    {/* 当天轨迹地图 */}
                    {(() => {
                      const dayTracks = tracksByDay[day] || []
                      if (dayTracks.length > 1 || dayCheckins.length > 0) {
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <Route size={10} />
                              {dayTracks.length > 1
                                ? `轨迹 ${(calculatePolylineDistance(dayTracks) / 1000).toFixed(1)}km`
                                : '轨迹'}
                            </div>
                            <MiniTrackMap tracks={dayTracks} checkins={dayCheckins} height={160} />
                          </div>
                        )
                      }
                      return null
                    })()}

                    {/* 当天打卡列表 */}
                    <div className="space-y-2">
                      {dayCheckins.map((c) => (
                        <div key={c.id} className="flex items-start gap-2">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                            {c.sequence_no}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-300">{c.title || `打卡 #${c.sequence_no}`}</div>
                            <div className="text-[10px] text-slate-600">{c.address}</div>
                            {c.complaint_content && (
                              <div className="mt-0.5 text-[10px] text-rose-400">投诉：{c.complaint_content}</div>
                            )}
                            {c.solution_result && (
                              <div className="mt-0.5 text-[10px] text-emerald-400">处理：{c.solution_result}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {sortedDays.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-600">暂无记录</div>
          )}
        </div>
      )}
    </div>
  )
}
