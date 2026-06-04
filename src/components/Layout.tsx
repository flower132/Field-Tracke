import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const hideNav = location.pathname === '/login'

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950">
      <main className="flex-1 overflow-y-auto overflow-x-hidden safe-top safe-bottom">
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}
