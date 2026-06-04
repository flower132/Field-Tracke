import { useState, useMemo } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { Users, Route, MapPin, ClipboardCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getUsers, getCheckins } from '../api/supabase'
import { getLast7DaysRange, formatDistance } from '../utils/helpers'
import { getUserColor } from '../utils/constants'
import type { UserStats } from '../types'

export default function StatsPage() {
  const [period, setPeriod] = useState<'7days' | '30days' | 'all'>('7days')

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await getUsers()
      return data || []
    },
  })

  const { data: checkins } = useQuery({
    queryKey: ['checkins', period],
    queryFn: async () => {
      let start: string | undefined
      let end: string | undefined
      if (period === '7days') {
        const range = getLast7DaysRange()
        start = range.start
        end = range.end
      } else if (period === '30days') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        start = d.toISOString()
        end = new Date().toISOString()
      }
      const { data } = await getCheckins(start, end)
      return data || []
    },
  })

  const stats = useMemo(() => {
    const onlineCount = (users || []).filter((u) => u.status === 'online').length
    const totalCheckins = checkins?.length || 0
    const totalComplaints = checkins?.length || 0
    return { onlineCount, totalCheckins, totalComplaints, totalMileage: 0 }
  }, [users, checkins])

  const userStats: UserStats[] = useMemo(() => {
    return (users || []).map((u, idx) => ({
      user: { ...u, color: getUserColor(idx) },
      todayMileage: 0,
      todayOnlineMinutes: 0,
      todayCheckins: (checkins || []).filter((c) => c.user_id === u.id).length,
      todayComplaints: (checkins || []).filter((c) => c.user_id === u.id).length,
    }))
  }, [users, checkins])

  const heatPoints = useMemo(() => {
    return (checkins || []).map((c) => ({
      lat: c.latitude,
      lng: c.longitude,
      intensity: 0.6 + Math.random() * 0.4,
    }))
  }, [checkins])

  const periodOptions = [
    { key: '7days' as const, label: '最近7天' },
    { key: '30days' as const, label: '最近30天' },
    { key: 'all' as const, label: '全部' },
  ]

  return (
    <div className="h-full overflow-y-auto px-4 pb-20 pt-4">
      <h1 className="text-xl font-bold text-slate-100">统计分析</h1>
      <p className="text-sm text-slate-500">运营数据概览</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-900 p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Users size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.onlineCount}</div>
          <div className="text-xs text-slate-500">在线人员</div>
        </div>
        <div className="rounded-2xl bg-slate-900 p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400">
            <Route size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{formatDistance(stats.totalMileage)}</div>
          <div className="text-xs text-slate-500">总里程</div>
        </div>
        <div className="rounded-2xl bg-slate-900 p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <MapPin size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.totalCheckins}</div>
          <div className="text-xs text-slate-500">打卡总数</div>
        </div>
        <div className="rounded-2xl bg-slate-900 p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
            <ClipboardCheck size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.totalComplaints}</div>
          <div className="text-xs text-slate-500">处理投诉</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">人员统计</h2>
        </div>
        <div className="mt-3 space-y-2">
          {userStats.map((s) => (
            <div key={s.user.id} className="flex items-center justify-between rounded-xl bg-slate-800/50 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.user.color }} />
                <span className="text-sm text-slate-200">{s.user.name}</span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500">
                <span>{s.todayCheckins} 打卡</span>
                <span>{s.todayComplaints} 投诉</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">投诉热力图</h2>
          <div className="flex gap-1">
            {periodOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  period === opt.key ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative h-64 overflow-hidden rounded-xl">
          <MapContainer center={[39.9042, 116.4074]} zoom={11} className="h-full w-full" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </MapContainer>
          {heatPoints.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-[400]">
              {heatPoints.slice(0, 30).map((p, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: `${((p.lng - 115.7) / 1.4) * 100}%`,
                    top: `${((40.2 - p.lat) / 0.6) * 100}%`,
                    width: 60,
                    height: 60,
                    marginLeft: -30,
                    marginTop: -30,
                    background: `radial-gradient(circle, rgba(245,158,11,${p.intensity * 0.5}) 0%, transparent 70%)`,
                  }}
                />
              ))}
            </div>
          )}
          {heatPoints.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-sm text-slate-500">
              暂无数据
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
