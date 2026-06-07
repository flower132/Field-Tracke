import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { getCurrentUser, supabase } from '../api/supabase'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  loadUser: () => Promise<void>
  logout: () => Promise<void>
}

// 初始化时通过 onAuthStateChange 同步 session 状态
// 这样刷新页面时 Supabase 会自动恢复 session，无需手动轮询
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    getCurrentUser().then((user) => {
      useAuthStore.getState().setUser(user)
    })
  }
  if (event === 'SIGNED_OUT') {
    useAuthStore.getState().setUser(null)
  }
})

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      loadUser: async () => {
        set({ isLoading: true })
        try {
          const user = await getCurrentUser()
          set({ user, isAuthenticated: !!user, isLoading: false })
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },
      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'field-tracker-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
