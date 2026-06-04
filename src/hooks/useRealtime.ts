import { useEffect } from 'react'
import { subscribeToTracks, subscribeToCheckins } from '../api/supabase'
import { useQueryClient } from '@tanstack/react-query'

export function useRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const tracksSub = subscribeToTracks(() => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] })
      queryClient.invalidateQueries({ queryKey: ['latest-tracks'] })
    })

    const checkinsSub = subscribeToCheckins(() => {
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    })

    return () => {
      tracksSub.unsubscribe()
      checkinsSub.unsubscribe()
    }
  }, [queryClient])
}
