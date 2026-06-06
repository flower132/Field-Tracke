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
