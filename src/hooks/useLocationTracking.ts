import { useEffect, useRef, useCallback } from 'react'
import { useLocationStore } from '../store/locationStore'
import { useAuthStore } from '../store/authStore'
import { insertTrack } from '../api/supabase'
import { LOCATION_INTERVAL } from '../utils/constants'

export function useLocationTracking() {
  const { user } = useAuthStore()
  const { isTracking, setLocation, setBattery, setTracking, setError } = useLocationStore()
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const uploadLocation = useCallback(
    async (position: GeolocationPosition) => {
      if (!user) return
      const { latitude, longitude, speed, accuracy } = position.coords
      setLocation(latitude, longitude, speed || 0, accuracy)

      await insertTrack({
        user_id: user.id,
        latitude,
        longitude,
        speed: speed || 0,
        battery: 100, // Will be updated via Battery API if available
      })
    },
    [user, setLocation]
  )

  useEffect(() => {
    if (!user || user.role !== 'tester') return

    // Get battery level if available
    if ('getBattery' in navigator) {
      // @ts-ignore
      navigator.getBattery().then((battery: any) => {
        setBattery(battery.level * 100)
        battery.addEventListener('levelchange', () => {
          setBattery(battery.level * 100)
        })
      })
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user, setBattery])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('浏览器不支持地理定位')
      return
    }

    setTracking(true)

    // Immediate position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        uploadLocation(pos)
      },
      (err) => {
        setError(err.message)
      },
      { enableHighAccuracy: true }
    )

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        uploadLocation(pos)
      },
      (err) => {
        setError(err.message)
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    )

    // Fallback interval upload
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => uploadLocation(pos),
        () => {},
        { enableHighAccuracy: true }
      )
    }, LOCATION_INTERVAL)
  }, [uploadLocation, setTracking, setError])

  const stopTracking = useCallback(() => {
    setTracking(false)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [setTracking])

  return { isTracking, startTracking, stopTracking }
}
