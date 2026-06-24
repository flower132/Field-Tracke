import { useEffect, useRef, useCallback } from 'react'
import { useLocationStore } from '../store/locationStore'
import { useAuthStore } from '../store/authStore'
import { useTrackingModeStore, MODE_CONFIGS } from '../store/trackingModeStore'
import { insertTrack } from '../api/supabase'
import { addPendingTask } from '../lib/indexeddb'
import { calculateDistance } from '../utils/helpers'

/* ============================================================
   定位优化算法说明
   ============================================================
   1. 精度过滤
      - accuracy > 80米：直接忽略，不更新任何状态
      - accuracy > 50米：只更新UI显示（位置/精度），不写入数据库

   2. 静止判断
      - 与上一个有效点距离 < 模式阈值（步行5米/车测30米/省电50米）
      - 且速度 < 模式阈值（步行0.5/车测3/省电1 km/h）
      - 连续 STATIONARY_FRAMES 帧后判定为静止，不上传

   3. 最小移动距离
      - 位置变化 < 模式阈值（步行5米/车测20米/省电50米）不写入数据库

   4. 速度计算
      - 优先使用 position.coords.speed（浏览器原生，单位 m/s）
      - 如果为空，根据时间差和距离自动计算：speed = dist/time * 3.6 → km/h

   5. 状态上报
      - 通过 accuracy / speed / isTracking 供首页显示GPS状态
   ============================================================ */

const STATIONARY_FRAMES = 3      // 连续静止帧数后才确认静止（防抖）
const ACCURACY_IGNORE = 80       // 超过此精度直接丢弃（米）
const ACCURACY_POOR = 50         // 超过此精度只显示不上传（米）

export function useLocationTracking() {
  const { user } = useAuthStore()
  const mode = useTrackingModeStore((s) => s.mode)
  const config = MODE_CONFIGS[mode]
  const { isTracking, setLocation, setBattery, setTracking, setError } = useLocationStore()

  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Battery API 引用，用于 cleanup 时移除监听器
  interface BatteryManager {
    level: number
    addEventListener: (type: string, handler: () => void) => void
    removeEventListener: (type: string, handler: () => void) => void
  }

  const batteryRef = useRef<{
    battery: BatteryManager
    handler: () => void
  } | null>(null)

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

      // 1. 精度过滤：>80m 完全忽略
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

      const prev = lastValidRef.current
      let speedKmh: number

      if (prev) {
        const distance = calculateDistance(prev.lat, prev.lng, latitude, longitude)
        const timeDiffSec = Math.max((now - prev.time) / 1000, 0.1)

        // 速度计算优化：优先使用原生 speed（m/s → km/h）
        if (typeof speed === 'number' && !isNaN(speed) && speed >= 0) {
          speedKmh = speed * 3.6
        } else {
          speedKmh = (distance / timeDiffSec) * 3.6
        }

        // 2. 静止判断：连续小位移 + 低速
        if (distance < config.stationaryDistance && speedKmh < config.stationarySpeed) {
          staticCounterRef.current++
          if (staticCounterRef.current >= STATIONARY_FRAMES) {
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
        if (distance < config.minMoveDistance) {
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
    [config]
  )

  const uploadLocation = useCallback(
    async (position: GeolocationPosition, force = false) => {
      if (!user) return

      const result = evaluatePosition(position)

      // 始终更新UI状态（让首页能看到最新位置和精度）
      setLocation(result.lat, result.lng, result.speedKmh, result.accuracy, result.isStatic)

      // 2. 精度太差：只显示不上传（force 为 true 时仍不上传低精度点）
      if (result.accuracy > ACCURACY_POOR) {
        return
      }

      // 3. 静止或微抖动：不上传数据库，除非强制上传
      if (!result.shouldUpload && !force) {
        return
      }

      const payload = {
        user_id: user.id,
        latitude: result.lat,
        longitude: result.lng,
        speed: result.speedKmh,
        battery: 100,
      }

      if (!navigator.onLine) {
        await addPendingTask('tracks', payload)
        return
      }

      await insertTrack(payload)
    },
    [user, setLocation, evaluatePosition]
  )

  const forceUpload = useCallback(async () => {
    if (!user || !navigator.geolocation) return
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          // 强制上传：绕过距离/静止过滤，但仍受精度过滤保护
          await uploadLocation(pos, true)
          resolve()
        },
        () => {
          resolve()
        },
        { enableHighAccuracy: config.enableHighAccuracy, maximumAge: 0, timeout: 10000 }
      )
    })
  }, [user, config, uploadLocation])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('浏览器不支持地理定位')
      return
    }

    setTracking(true)
    lastValidRef.current = null
    staticCounterRef.current = 0

    const geoOptions = {
      enableHighAccuracy: config.enableHighAccuracy,
      maximumAge: 0,
      timeout: 10000,
    }

    // Immediate position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        uploadLocation(pos)
      },
      (err) => {
        setError(err.message)
      },
      geoOptions
    )

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        uploadLocation(pos)
      },
      (err) => {
        setError(err.message)
      },
      geoOptions
    )

    // Fallback interval upload
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => uploadLocation(pos),
        () => {},
        geoOptions
      )
    }, config.uploadIntervalMs)
  }, [config, uploadLocation, setTracking, setError])

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

  // 监听模式变化，自动重启 tracking 以应用新参数
  useEffect(() => {
    if (!isTracking) return
    stopTracking()
    startTracking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Battery API + cleanup
  useEffect(() => {
    if (!user || user.role !== 'tester') return

    if ('getBattery' in navigator) {
      // @ts-expect-error navigator.getBattery is not in all type definitions
      navigator.getBattery().then((battery: BatteryManager) => {
        const handler = () => {
          setBattery(battery.level * 100)
        }
        batteryRef.current = { battery, handler }
        setBattery(battery.level * 100)
        battery.addEventListener('levelchange', handler)
      })
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (batteryRef.current) {
        const { battery, handler } = batteryRef.current
        battery.removeEventListener('levelchange', handler)
        batteryRef.current = null
      }
    }
  }, [user, setBattery])

  return { isTracking, startTracking, stopTracking, forceUpload }
}
