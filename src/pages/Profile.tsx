import { LogOut, MapPin, Route, ClipboardCheck, Shield, Radio } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import { useLocationTracking } from '../hooks/useLocationTracking'
import { useQuery } from '@tanstack/react-query'
import { getTracksByUser, getCheckinsByUser } from '../api/supabase'
import { getTodayRange, formatDistance, calculatePolylineDistance } from '../utils/helpers'

export default function Profile() {
  const { user, logout } = useAuthStore()
  const { latitude, longitude, speed, battery, isTracking } = useLocationStore()
  const { startTracking, stopTracking } = useLocationTracking()
  const isAdmin = user?.role === 'admin'

  const { data: myTracks } = useQuery({
    queryKey: ['tracks', 'mine', 'today'],
    queryFn: async () => {
      if (!user) return []
      const range = getTodayRange()
      const { data } = await getTracksByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user && !isAdmin,
  })

  const { data: myCheckins } = useQuery({
    queryKey: ['checkins', 'mine', 'today'],
    queryFn: async () => {
      if (!user) return []
      const { data } = await getCheckinsByUser(user.id)
      return data || []
    },
    enabled: !!user && !isAdmin,
  })

  const todayMileage = myTracks ? calculatePolylineDistance(myTracks) : 0
  const todayCheckins = myCheckins?.length || 0
  const todayComplaints =
    myCheckins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

  return (
    <div className="h-full overflow-y-auto px-4 pb-20 pt-4">
      {/* 用户信息卡片 */}
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600/20 text-lg font-bold text-primary-400">
            {user?.name?.charAt(0) || '?'}
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-100">{user?.name || '未命名'}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Shield size={12} />
                {isAdmin ? '管理员' : '测试人员'}
              </span>
              <span>{user?.phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 测试人员：位置上传控制 */}
      {!isAdmin && (
        <div className="mt-4 rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-200">位置上传</h2>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">状态</span>
              <span className={isTracking ? 'text-emerald-400' : 'text-slate-500'}>
                {isTracking ? '运行中' : '已停止'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">纬度</span>
              <span className="text-slate-200">{latitude?.toFixed(5) || '--'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">经度</span>
              <span className="text-slate-200">{longitude?.toFixed(5) || '--'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">速度</span>
              <span className="text-slate-200">{(speed || 0).toFixed(1)} km/h</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">电量</span>
              <span className="text-slate-200">{battery || '--'}%</span>
            </div>
            <button
              onClick={isTracking ? stopTracking : startTracking}
              className={`w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors ${
                isTracking ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isTracking ? '停止上传位置' : '开始上传位置'}
            </button>
          </div>
        </div>
      )}

      {/* 今日概览 */}
      {!isAdmin && (
        <div className="mt-4 rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-200">今日概览</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <Route size={18} className="mx-auto text-primary-400" />
              <div className="mt-1 text-lg font-bold text-slate-100">{formatDistance(todayMileage)}</div>
              <div className="text-[10px] text-slate-500">里程</div>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <MapPin size={18} className="mx-auto text-amber-400" />
              <div className="mt-1 text-lg font-bold text-slate-100">{todayCheckins}</div>
              <div className="text-[10px] text-slate-500">打卡</div>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-3 text-center">
              <ClipboardCheck size={18} className="mx-auto text-rose-400" />
              <div className="mt-1 text-lg font-bold text-slate-100">{todayComplaints}</div>
              <div className="text-[10px] text-slate-500">投诉</div>
            </div>
          </div>
        </div>
      )}

      {/* 管理员：定位状态 */}
      {isAdmin && (
        <div className="mt-4 rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-200">系统状态</h2>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">当前定位</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Radio size={12} />
                正常
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">数据同步</span>
              <span className="text-emerald-400">实时</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={logout}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800"
      >
        <LogOut size={16} />
        退出登录
      </button>
    </div>
  )
}
