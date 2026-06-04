import { useNavigate } from 'react-router-dom'
import { Users, Route, MapPin, ClipboardCheck, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { getUsers, getCheckins } from '../api/supabase'
import { getTodayRange, formatDistance } from '../utils/helpers'
import type { StatsSummary } from '../types'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await getUsers()
      return data || []
    },
    enabled: isAdmin,
  })

  const { data: checkins } = useQuery({
    queryKey: ['checkins', 'today'],
    queryFn: async () => {
      const range = getTodayRange()
      const { data } = await getCheckins(range.start, range.end)
      return data || []
    },
  })

  const onlineCount = users?.filter((u) => u.status === 'online').length || 0
  const totalCheckins = checkins?.length || 0
  const totalComplaints = checkins?.length || 0
  const totalMileage = 0 // 需要计算轨迹

  const stats: StatsSummary = {
    onlineCount,
    totalMileage,
    totalCheckins,
    totalComplaints,
  }

  const statCards = [
    { label: '今日在线', value: stats.onlineCount, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', path: '/map' },
    { label: '今日里程', value: formatDistance(stats.totalMileage), icon: Route, color: 'text-primary-400', bg: 'bg-primary-500/10', path: '/tracks' },
    { label: '今日打卡', value: stats.totalCheckins, icon: MapPin, color: 'text-amber-400', bg: 'bg-amber-500/10', path: '/checkins' },
    { label: '处理投诉', value: stats.totalComplaints, icon: ClipboardCheck, color: 'text-rose-400', bg: 'bg-rose-500/10', path: '/checkins' },
  ]

  return (
    <div className="space-y-4 p-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {isAdmin ? '监控仪表盘' : '我的工作台'}
          </h1>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <div className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
          {user?.name}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.path)}
              className="flex flex-col rounded-2xl bg-slate-900 p-4 text-left transition-colors active:bg-slate-800"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                <Icon size={20} />
              </div>
              <span className="text-2xl font-bold text-slate-100">{card.value}</span>
              <span className="mt-0.5 text-xs text-slate-500">{card.label}</span>
            </button>
          )
        })}
      </div>

      {isAdmin && (
        <div className="rounded-2xl bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">人员状态</h2>
            <button onClick={() => navigate('/map')} className="text-xs text-primary-400 flex items-center gap-0.5">
              查看地图 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {(users || []).slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-slate-800/50 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${u.status === 'online' ? 'bg-emerald-400' : u.status === 'busy' ? 'bg-amber-400' : 'bg-slate-600'}`} />
                  <span className="text-sm text-slate-200">{u.name}</span>
                </div>
                <span className="text-xs text-slate-500">{u.status === 'online' ? '在线' : u.status === 'busy' ? '处理中' : '离线'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">最近打卡</h2>
          <button onClick={() => navigate(isAdmin ? '/checkins' : '/checkin')} className="text-xs text-primary-400 flex items-center gap-0.5">
            全部 <ChevronRight size={14} />
          </button>
        </div>
        <div className="space-y-2">
          {(checkins || []).slice(0, 5).map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-800/50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{c.title || `打卡点 #${c.sequence_no}`}</span>
                <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{c.address}</p>
            </div>
          ))}
          {(checkins || []).length === 0 && (
            <p className="py-4 text-center text-sm text-slate-600">暂无打卡记录</p>
          )}
        </div>
      </div>
    </div>
  )
}
