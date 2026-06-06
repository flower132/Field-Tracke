import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-400">加载中...</div>
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export function TesterGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-400">加载中...</div>
  if (user?.role !== 'tester') return <Navigate to="/" replace />
  return <>{children}</>
}
