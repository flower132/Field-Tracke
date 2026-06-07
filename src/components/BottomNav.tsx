import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Map, MapPin, Route, BarChart3, User } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useOfflineSync } from '../hooks/useOfflineSync'

const testerNav = [
  { path: '/', icon: LayoutDashboard, label: '首页' },
  { path: '/map', icon: Map, label: '地图' },
  { path: '/checkin', icon: MapPin, label: '打卡' },
  { path: '/profile', icon: User, label: '我的' },
]

const adminNav = [
  { path: '/', icon: LayoutDashboard, label: '总览' },
  { path: '/map', icon: Map, label: '监控' },
  { path: '/tracks', icon: Route, label: '轨迹' },
  { path: '/stats', icon: BarChart3, label: '统计' },
  { path: '/profile', icon: User, label: '我的' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { pendingCount } = useOfflineSync()
  const navItems = user?.role === 'admin' ? adminNav : testerNav

  return (
    <nav className="shrink-0 border-t border-slate-800/60 bg-slate-900/95 backdrop-blur safe-bottom">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          const showBadge = item.path === '/checkin' && pendingCount > 0 && user?.role !== 'admin'
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-all active:scale-95 ${
                isActive ? 'text-primary-400' : 'text-slate-500'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {showBadge && (
                <span className="absolute -right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
