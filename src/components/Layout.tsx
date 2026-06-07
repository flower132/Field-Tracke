import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { CloudOff, RotateCcw } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const hideNav = location.pathname === '/login'
  const { pendingCount, triggerSync, syncStatus } = useOfflineSync()

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950">
      {/* 离线提示条 */}
      {pendingCount > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-2 bg-amber-500/15 px-4 py-2"
        >
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <CloudOff size={14} />
            <span>
              {syncStatus === 'syncing'
                ? '同步中...'
                : `离线模式 · 待同步 ${pendingCount} 条数据`}
            </span>
          </div>
          {syncStatus !== 'syncing' && navigator.onLine && (
            <button
              onClick={triggerSync}
              className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[10px] font-medium text-amber-400"
            >
              <RotateCcw size={10} />
              立即同步
            </button>
          )}
        </div>
      )}
      <main className="flex-1 overflow-y-auto overflow-x-hidden safe-top safe-bottom">
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}
