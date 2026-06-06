import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useRealtime } from './hooks/useRealtime'
import { AdminGuard } from './components/RoleGuard'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MapView from './pages/MapView'
import CheckinPage from './pages/CheckinPage'
import TrackHistory from './pages/TrackHistory'
import TrackPlayback from './pages/TrackPlayback'
import CheckinList from './pages/CheckinList'
import StatsPage from './pages/StatsPage'
import Profile from './pages/Profile'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-400">加载中...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  useRealtime()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/checkin" element={<CheckinPage />} />
                <Route path="/tracks" element={<TrackHistory />} />
                <Route path="/profile" element={<Profile />} />
                {/* 管理员专属路由 */}
                <Route
                  path="/checkins"
                  element={
                    <AdminGuard>
                      <CheckinList />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/playback"
                  element={
                    <AdminGuard>
                      <TrackPlayback />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/stats"
                  element={
                    <AdminGuard>
                      <StatsPage />
                    </AdminGuard>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

export default AppRoutes
