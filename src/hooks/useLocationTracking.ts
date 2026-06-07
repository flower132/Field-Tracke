import { useEffect, useRef, useCallback } from 'react'
import { useLocationStore } from '../store/locationStore'
import { useAuthStore } from '../store/authStore'
import { insertTrack } from '../api/supabase'
import { addPendingTask } from '../lib/indexeddb'
import { LOCATION_INTERVAL } from '../utils/constants'
import { calculateDistance } from '../utils/helpers'

/* ============================================================
   定位优化算法说明
   ============================================================
   1. 精度过滤
      - accuracy > 100米：直接忽略，不更新任何状态
      - accuracy > 50米：只更新UI显示（位置/精度），不写入数据库

   2. 静止判断
      - 与上一个有效点距离 < 15米
      - 且速度 < 1 km/h
      - 判定为静止，不上传轨迹，里程不累计

   3. 最小移动距离
      - 位置变化 < 10米（非静止状态）
      - 不写入轨迹数据库（避免GPS微抖动产生大量冗余点）

   4. 速度计算优化
      - 优先使用 position.coords.speed（浏览器原生，单位 m/s）
      - 如果为空，根据时间差和距离自动计算：speed = dist/time * 3.6 → km/h

   5. 状态上报
      - 通过 accuracy / speed / isTracking 供首页显示GPS状态
   ============================================================ */

// 过滤参数常量
const ACCURACY_IGNORE = 50       // 超过此精度直接丢弃（米）
const ACCURACY_POOR = 30         // 超过此精度只显示不上传（米）
const STATIONARY_DISTANCE = 15   // 静止判定距离阈值（米）
const STATIONARY_SPEED = 1       // 静止判定速度阈值（km/h）
const MIN_MOVE_DISTANCE = 10     // 最小移动距离（米）
const STATIONARY_FRAMES = 3      // 连续静止帧数后才确认静止（防抖）

export function useLocationTracking() {
  const { user } = useAuthStore()
  const { isTracking, setLocation, setBattery, setTracking, setError } = useLocationStore()
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 维护上一个有效位置（用于距离/速度计算）
  const lastValidRef = useRef<{
    lat: number
    lng: number
    time: number
    speed: number
  } | null>(null)

  // 连续静止计数器（防抖）
  const staticCounterRef = useRef(0)

  // 计算并过滤位置，返回是否应上传到数据库
  const evaluatePosition = useCallback(
    (position: GeolocationPosition): {
      shouldUpload: boolean
      lat: number
      lng: number
      speedKmh: number
      accuracy: number
      isStatic: boolean
    } => {
      const { latitude, longitude, accuracy, speed } = position.coords
      const now = Date.now()

      // 1. 精度过滤：>100m 完全忽略
      if (accuracy > ACCURACY_IGNORE) {
        return {
          shouldUpload: false,
          lat: latitude,
          lng: longitude,
          speedKmh: 0,
          accuracy,
          isStatic: true,
        }
      }

      let speedKmh = 0
      let distance = 0
      const prev = lastValidRef.current

      if (prev) {
        distance = calculateDistance(prev.lat, prev.lng, latitude, longitude)
        const timeDiffSec = Math.max((now - prev.time) / 1000, 0.1)

        // 4. 速度计算优化：优先使用原生 speed（m/s → km/h）
        if (typeof speed === 'number' && !isNaN(speed) && speed >= 0) {
          speedKmh = speed * 3.6
        } else {
          // 自动计算：dist(m) / time(s) = m/s → *3.6 = km/h
          speedKmh = (distance / timeDiffSec) * 3.6
        }

        // 2. 静止判断：连续小位移 + 低速
        if (distance < STATIONARY_DISTANCE && speedKmh < STATIONARY_SPEED) {
          staticCounterRef.current++
          if (staticCounterRef.current >= STATIONARY_FRAMES) {
            // 确认静止：不上传，速度归零
            return {
              shouldUpload: false,
              lat: latitude,
              lng: longitude,
              speedKmh: 0,
              accuracy,
              isStatic: true,
            }
          }
        } else {
          staticCounterRef.current = 0
        }

        // 3. 最小移动距离过滤
        if (distance < MIN_MOVE_DISTANCE) {
          return {
            shouldUpload: false,
            lat: latitude,
            lng: longitude,
            speedKmh,
            accuracy,
            isStatic: false,
          }
        }
      } else {
        // 首个点：如果有原生速度则使用，否则为0
        speedKmh = typeof speed === 'number' && !isNaN(speed) && speed >= 0 ? speed * 3.6 : 0
      }

      // 通过所有过滤，更新 lastValidRef
      lastValidRef.current = { lat: latitude, lng: longitude, time: now, speed: speedKmh }
      staticCounterRef.current = 0

      return {
        shouldUpload: true,
        lat: latitude,
        lng: longitude,
        speedKmh,
        accuracy,
        isStatic: false,
      }
    },
    []
  )

  const uploadLocation = useCallback(
    async (position: GeolocationPosition) => {
      if (!user) return

      const result = evaluatePosition(position)

      // 始终更新UI状态（让首页能看到最新位置和精度）
      setLocation(result.lat, result.lng, result.speedKmh, result.accuracy, result.isStatic)

      // 2. 精度太差：只显示不上传
      if (result.accuracy > ACCURACY_POOR) {
        return
      }

      // 3. 静止或微抖动：不上传数据库
      if (!result.shouldUpload) {
        return
      }

      // 通过过滤，写入轨迹数据库
      const payload = {
        user_id: user.id,
        latitude: result.lat,
        longitude: result.lng,
        speed: result.speedKmh,
        battery: 100, // Will be updated via Battery API if available
      }

      if (!navigator.onLine) {
        await addPendingTask('tracks', payload)
        return
      }

      await insertTrack(payload)
    },
    [user, setLocation, evaluatePosition]
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
    // 重置状态
    lastValidRef.current = null
    staticCounterRef.current = 0

    // Immediate position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        uploadLocation(pos)
      },
      (err) => {
        setError(err.message)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        uploadLocation(pos)
      },
      (err) => {
        setError(err.message)
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    )

    // Fallback interval upload
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => uploadLocation(pos),
        () => {},
        { enableHighAccuracy: true, timeout: 15000 }
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
    lastValidRef.current = null
    staticCounterRef.current = 0
  }, [setTracking])

  return { isTracking, startTracking, stopTracking }
}
