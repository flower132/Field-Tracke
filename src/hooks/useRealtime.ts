import { useEffect, useState, useCallback } from 'react'
import { subscribeToTracks, subscribeToCheckins } from '../api/supabase'
import { useQueryClient } from '@tanstack/react-query'

export function useRealtime() {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  const invalidateLatest = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tracks'] })
    queryClient.invalidateQueries({ queryKey: ['latest-tracks'] })
  }, [queryClient])

  const invalidateCheckins = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['checkins'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }, [queryClient])

  useEffect(() => {
    const tracksSub = subscribeToTracks(() => {
      invalidateLatest()
    })

    const checkinsSub = subscribeToCheckins(() => {
      invalidateCheckins()
    })

    // 监听连接状态
    tracksSub.subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED')
    })

    return () => {
      tracksSub.unsubscribe()
      checkinsSub.unsubscribe()
      setIsConnected(false)
    }
  }, [invalidateLatest, invalidateCheckins])

  return { isConnected }
}
