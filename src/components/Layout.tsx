import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { CloudOff, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const hideNav = location.pathname === '/login'
  const { pendingCount, triggerSync, syncStatus } = useOfflineSync()

  const showOfflineBar = pendingCount > 0 || syncStatus === 'failed'
  const showSuccessBar = syncStatus === 'success' && pendingCount === 0

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950">
      {/* 离线/同步提示条 */}
      {showOfflineBar && (
        <div className={`shrink-0 flex items-center justify-between gap-2 px-4 py-2 ${
          syncStatus === 'failed' ? 'bg-rose-500/15' : 'bg-amber-500/15'
        }`}>
          <div className={`flex items-center gap-2 text-xs ${
            syncStatus === 'failed' ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {syncStatus === 'failed' ? <AlertCircle size={14} /> : <CloudOff size={14} />}
            <span>
              {syncStatus === 'syncing'
                ? '同步中...'
                : syncStatus === 'failed'
                ? '同步失败，请重试'
                : `待同步 ${pendingCount} 条数据`}
            </span>
          </div>
          {syncStatus !== 'syncing' && navigator.onLine && (
            <button
              onClick={triggerSync}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${
                syncStatus === 'failed'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              <RotateCcw size={10} />
              {syncStatus === 'failed' ? '重试' : '立即同步'}
            </button>
          )}
        </div>
      )}

      {/* 同步成功提示 */}
      {showSuccessBar && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-emerald-500/10 px-4 py-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span className="text-xs text-emerald-400">同步成功，数据已上传</span>
        </div>
      )}

      <main className="flex-1 overflow-y-auto overflow-x-hidden safe-top safe-bottom">
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}
