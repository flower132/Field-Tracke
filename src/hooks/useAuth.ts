import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, isLoading, isAuthenticated, loadUser, logout } = useAuthStore()
  const hasRun = useRef(false)

  useEffect(() => {
    // 已经认证且有用户，直接返回
    if (isAuthenticated && user) {
      if (isLoading) {
        useAuthStore.setState({ isLoading: false })
      }
      return
    }

    // 防止 StrictMode 下执行两次
    if (hasRun.current) return
    hasRun.current = true

    // 首次加载：通过 supabase.getSession() 同步获取 session
    loadUser()
  }, [])

  return { user, isLoading, isAuthenticated, logout }
}
