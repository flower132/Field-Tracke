import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Route, MapPin, ClipboardCheck, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getTracksByUser, getCheckinsByUser } from '../api/supabase'
import {
  getTodayRange,
  getWeekRange,
  getMonthRange,
  formatDistance,
  calculatePolylineDistance,
  calculateOnlineMinutes,
  formatDate,
  formatDateTime,
  getDayOfWeekLabel,
  groupByDay,
} from '../utils/helpers'
import PeriodOverviewCard from '../components/PeriodOverviewCard'
import { useState } from 'react'

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

      {/* 今日详情：轨迹 + 打卡列表 */}
      {period === 'today' && (
        <div className="mt-4 space-y-4">
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
                <div className="mt-2 text-xs text-slate-400">{c.complaint_content}</div>
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
                  <div className="space-y-2 border-t border-slate-800/50 px-4 py-3">
                    {dayCheckins.map((c) => (
                      <div key={c.id} className="flex items-start gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                          {c.sequence_no}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-300">{c.title || `打卡 #${c.sequence_no}`}</div>
                          <div className="text-[10px] text-slate-600">{c.address}</div>
                          {c.complaint_content && (
                            <div className="mt-0.5 text-[10px] text-slate-500">{c.complaint_content}</div>
                          )}
                        </div>
                      </div>
                    ))}
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
