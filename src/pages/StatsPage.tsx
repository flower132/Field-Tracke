import { useState, useMemo } from 'react'
import { Users, Route, MapPin, ClipboardCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getUsers, getCheckins, getTracks } from '../api/supabase'
import {
  getLast7DaysRange,
  formatDistance,
  formatDuration,
  calculatePolylineDistance,
  calculateOnlineMinutes,
} from '../utils/helpers'
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

  const { data: tracks } = useQuery({
    queryKey: ['tracks', period],
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
      const { data } = await getTracks(start, end)
      return data || []
    },
  })

  const tracksByUser = useMemo(() => {
    const map = new Map<string, import('../types').Track[]>()
    for (const t of tracks || []) {
      const arr = map.get(t.user_id) || []
      arr.push(t)
      map.set(t.user_id, arr)
    }
    return map
  }, [tracks])

  const stats = useMemo(() => {
    const onlineCount = (users || []).filter((u) => u.status === 'online').length
    const totalCheckins = checkins?.length || 0
    const totalComplaints =
      checkins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0
    const totalMileage = tracks ? calculatePolylineDistance(tracks) : 0
    return { onlineCount, totalCheckins, totalComplaints, totalMileage }
  }, [users, checkins, tracks])

  const userStats: UserStats[] = useMemo(() => {
    return (users || []).map((u, idx) => {
      const userTracks = tracksByUser.get(u.id) || []
      const userCheckins = (checkins || []).filter((c) => c.user_id === u.id)
      return {
        user: { ...u, color: getUserColor(idx) },
        todayMileage: calculatePolylineDistance(userTracks),
        todayOnlineMinutes: calculateOnlineMinutes(userTracks),
        todayCheckins: userCheckins.length,
        todayComplaints: userCheckins.filter((c) => c.complaint_content && c.complaint_content.trim()).length,
      }
    })
  }, [users, checkins, tracksByUser])

  const periodOptions = [
    { key: '7days' as const, label: '最近7天' },
    { key: '30days' as const, label: '最近30天' },
    { key: 'all' as const, label: '全部' },
  ]

  return (
    <div className="h-full overflow-y-auto px-4 pb-20 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">统计分析</h1>
          <p className="text-sm text-slate-500">运营数据概览</p>
        </div>
        <div className="flex gap-1">
          {periodOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                period === opt.key ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片 2x2 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Users size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.onlineCount}</div>
          <div className="mt-0.5 text-xs text-slate-500">在线人员</div>
        </div>
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400">
            <Route size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{formatDistance(stats.totalMileage)}</div>
          <div className="mt-0.5 text-xs text-slate-500">总里程</div>
        </div>
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <MapPin size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.totalCheckins}</div>
          <div className="mt-0.5 text-xs text-slate-500">打卡总数</div>
        </div>
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <ClipboardCheck size={18} />
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats.totalComplaints}</div>
          <div className="mt-0.5 text-xs text-slate-500">处理投诉</div>
        </div>
      </div>

      {/* 人员统计 */}
      <div className="mt-5 rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
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
                <span>{formatDistance(s.todayMileage)}</span>
                <span>{formatDuration(s.todayOnlineMinutes)}</span>
                <span>{s.todayCheckins} 打卡</span>
                <span>{s.todayComplaints} 投诉</span>
              </div>
            </div>
          ))}
          {userStats.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-600">暂无人员数据</p>
          )}
        </div>
      </div>
    </div>
  )
}
