import { useNavigate } from 'react-router-dom'
import { LogOut, Shield, Radio, Footprints, Car, Battery } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import { useLocationTracking } from '../hooks/useLocationTracking'
import { useTrackingModeStore, MODE_CONFIGS, type TrackingMode } from '../store/trackingModeStore'
import { useQuery } from '@tanstack/react-query'
import { getTracksByUser, getCheckinsByUser } from '../api/supabase'
import {
  getTodayRange,
  getWeekRange,
  getMonthRange,
  calculatePolylineDistance,
  calculateOnlineMinutes,
} from '../utils/helpers'
import PeriodOverviewCard from '../components/PeriodOverviewCard'

const MODE_ICONS: Record<TrackingMode, typeof Footprints> = {
  walking: Footprints,
  driving: Car,
  powerSave: Battery,
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { latitude, longitude, speed, battery, isTracking } = useLocationStore()
  const { startTracking, stopTracking } = useLocationTracking()
  const mode = useTrackingModeStore((s) => s.mode)
  const setMode = useTrackingModeStore((s) => s.setMode)
  const modeConfig = MODE_CONFIGS[mode]
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

  const { data: weekTracks } = useQuery({
    queryKey: ['tracks', 'mine', 'week'],
    queryFn: async () => {
      if (!user) return []
      const range = getWeekRange()
      const { data } = await getTracksByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user && !isAdmin,
  })

  const { data: monthTracks } = useQuery({
    queryKey: ['tracks', 'mine', 'month'],
    queryFn: async () => {
      if (!user) return []
      const range = getMonthRange()
      const { data } = await getTracksByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user && !isAdmin,
  })

  const { data: myCheckins } = useQuery({
    queryKey: ['checkins', 'mine', 'today'],
    queryFn: async () => {
      if (!user) return []
      const range = getTodayRange()
      const { data } = await getCheckinsByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user && !isAdmin,
  })

  const { data: weekCheckins } = useQuery({
    queryKey: ['checkins', 'mine', 'week'],
    queryFn: async () => {
      if (!user) return []
      const range = getWeekRange()
      const { data } = await getCheckinsByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user && !isAdmin,
  })

  const { data: monthCheckins } = useQuery({
    queryKey: ['checkins', 'mine', 'month'],
    queryFn: async () => {
      if (!user) return []
      const range = getMonthRange()
      const { data } = await getCheckinsByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !!user && !isAdmin,
  })

  const todayMileage = myTracks ? calculatePolylineDistance(myTracks) : 0
  const todayOnlineMinutes = myTracks ? calculateOnlineMinutes(myTracks) : 0
  const todayCheckins = myCheckins?.length || 0
  const todayComplaints =
    myCheckins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

  const weekMileage = weekTracks ? calculatePolylineDistance(weekTracks) : 0
  const weekOnlineMinutes = weekTracks ? calculateOnlineMinutes(weekTracks) : 0
  const weekCheckinsCount = weekCheckins?.length || 0
  const weekComplaints =
    weekCheckins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

  const monthMileage = monthTracks ? calculatePolylineDistance(monthTracks) : 0
  const monthOnlineMinutes = monthTracks ? calculateOnlineMinutes(monthTracks) : 0
  const monthCheckinsCount = monthCheckins?.length || 0
  const monthComplaints =
    monthCheckins?.filter((c) => c.complaint_content && c.complaint_content.trim()).length || 0

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

      {/* 测试人员：定位模式切换 */}
      {!isAdmin && (
        <div className="mt-4 rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-200">定位模式</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(Object.keys(MODE_CONFIGS) as TrackingMode[]).map((m) => {
              const cfg = MODE_CONFIGS[m]
              const Icon = MODE_ICONS[m]
              const active = mode === m
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex flex-col items-center justify-center rounded-xl border py-3 text-xs transition-colors ${
                    active
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={18} className="mb-1" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
          <div className="mt-3 space-y-1.5 rounded-xl bg-slate-950/50 p-3 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>上传频率</span>
              <span className="text-slate-200">
                {modeConfig.uploadIntervalMs >= 60000
                  ? `${Math.round(modeConfig.uploadIntervalMs / 60000)}分钟`
                  : `${Math.round(modeConfig.uploadIntervalMs / 1000)}秒`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>最小记录距离</span>
              <span className="text-slate-200">{modeConfig.minMoveDistance}米</span>
            </div>
            <div className="flex items-center justify-between">
              <span>高精度定位</span>
              <span className="text-slate-200">{modeConfig.enableHighAccuracy ? '开启' : '关闭'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 测试人员：周期概览 */}
      {!isAdmin && (
        <div className="mt-4 space-y-3">
          <h2 className="font-semibold text-slate-200">数据概览</h2>
          <PeriodOverviewCard
            title="今日概览"
            mileage={todayMileage}
            onlineMinutes={todayOnlineMinutes}
            checkins={todayCheckins}
            complaints={todayComplaints}
            onClick={() => navigate('/period/today')}
          />
          <PeriodOverviewCard
            title="本周概览"
            mileage={weekMileage}
            onlineMinutes={weekOnlineMinutes}
            checkins={weekCheckinsCount}
            complaints={weekComplaints}
            onClick={() => navigate('/period/week')}
          />
          <PeriodOverviewCard
            title="本月概览"
            mileage={monthMileage}
            onlineMinutes={monthOnlineMinutes}
            checkins={monthCheckinsCount}
            complaints={monthComplaints}
            onClick={() => navigate('/period/month')}
          />
        </div>
      )}

      {/* 管理员：系统状态 */}
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
