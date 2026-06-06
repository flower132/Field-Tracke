import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, isLoading, isAuthenticated, loadUser, logout } = useAuthStore()

  useEffect(() => {
    // 已有用户且未在加载中，直接跳过
    if (isAuthenticated && user && !isLoading) return
    // 正在加载中或需要加载，且未认证
    if (!isAuthenticated && isLoading) {
      loadUser()
    }
  }, [isAuthenticated, isLoading, loadUser])

  return { user, isLoading, isAuthenticated, logout }
}
