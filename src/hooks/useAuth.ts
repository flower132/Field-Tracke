import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, isLoading, isAuthenticated, loadUser, logout } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated && isLoading) {
      loadUser()
    }
  }, [isAuthenticated, isLoading, loadUser])

  return { user, isLoading, isAuthenticated, logout }
}
