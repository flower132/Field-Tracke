import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MM-dd HH:mm', { locale: zhCN })
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm:ss', { locale: zhCN })
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'yyyy-MM-dd', { locale: zhCN })
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0) {
    return `${h}h${m}m`
  }
  return `${m}m`
}

export function getTodayRange() {
  const now = new Date()
  return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() }
}

export function getYesterdayRange() {
  const yesterday = subDays(new Date(), 1)
  return { start: startOfDay(yesterday).toISOString(), end: endOfDay(yesterday).toISOString() }
}

export function getLast7DaysRange() {
  return { start: startOfDay(subDays(new Date(), 6)).toISOString(), end: endOfDay(new Date()).toISOString() }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function calculatePolylineDistance(points: Array<{ latitude: number; longitude: number }>): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    )
  }
  return total
}

/**
 * 根据轨迹点计算在线时长（分钟）。
 * 规则：相邻轨迹点间隔超过 10 分钟视为离线，只累加连续段内的时长。
 */
export function calculateOnlineMinutes(tracks: Array<{ created_at: string }>): number {
  if (tracks.length === 0) return 0
  const sorted = [...tracks].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const GAP_MS = 10 * 60 * 1000 // 10 minutes
  let totalMs = 0
  let segmentStart = new Date(sorted[0].created_at).getTime()
  let prevTime = segmentStart

  for (let i = 1; i < sorted.length; i++) {
    const t = new Date(sorted[i].created_at).getTime()
    if (t - prevTime > GAP_MS) {
      totalMs += prevTime - segmentStart
      segmentStart = t
    }
    prevTime = t
  }
  totalMs += prevTime - segmentStart
  return Math.round(totalMs / 60000)
}

function buildAddressFromNominatim(data: any): string {
  if (!data || !data.address) {
    return ''
  }
  const addr = data.address
  const parts: string[] = []

  const country = addr.country || ''

  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.state ||
    addr.region ||
    ''

  const district =
    addr.suburb ||
    addr.district ||
    addr.neighbourhood ||
    addr.borough ||
    addr.locality ||
    addr.quarter ||
    addr.city_district ||
    addr.township ||
    addr.hamlet ||
    ''

  const road =
    addr.road ||
    addr.street ||
    addr.pedestrian ||
    addr.footway ||
    addr.cycleway ||
    addr.path ||
    addr.highway ||
    addr.avenue ||
    ''

  if (country) parts.push(country)
  if (city) parts.push(city)
  if (district) parts.push(district)
  if (road) parts.push(road)

  return parts.join('\n')
}

export function getAddressFromCoords(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const fallback = `${lat.toFixed(5)},${lng.toFixed(5)}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'FieldTracker/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    )
      .then((res) => {
        clearTimeout(timeoutId)
        if (!res.ok) {
          resolve(fallback)
          return
        }
        return res.json()
      })
      .then((data) => {
        if (!data || data.error) {
          resolve(fallback)
          return
        }
        const address = buildAddressFromNominatim(data)
        if (!address) {
          resolve(fallback)
          return
        }
        resolve(address)
      })
      .catch(() => {
        clearTimeout(timeoutId)
        resolve(fallback)
      })
  })
}

/* ============================================================
   图片压缩辅助函数（用于照片上传优化）
   ============================================================ */

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeMB?: number
}

/**
 * 将 File/Blob 压缩为指定质量的 JPEG Blob
 * 支持：
 * - 尺寸缩放（默认最大 1920x1920）
 * - 质量压缩（默认 0.85）
 * - 大于 maxSizeMB 时自动降低质量重试
 */
export function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<{ blob: Blob; dataUrl: string }> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.85, maxSizeMB = 3 } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // 等比缩放
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 canvas context'))
        return
      }

      // 移动端图片方向修正（EXIF Orientation）
      // 简单处理：不做复杂EXIF旋转，依赖浏览器自动处理
      ctx.drawImage(img, 0, 0, width, height)

      const tryCompress = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'))
              return
            }

            // 如果仍然大于 maxSizeMB 且质量还能降，继续压缩
            if (blob.size > maxSizeMB * 1024 * 1024 && q > 0.5) {
              tryCompress(q - 0.1)
              return
            }

            const reader = new FileReader()
            reader.onload = () => {
              resolve({ blob, dataUrl: reader.result as string })
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
          },
          'image/jpeg',
          q
        )
      }

      tryCompress(quality)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    img.src = url
  })
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function getWeekRange() {
  const now = new Date()
  return { start: startOfWeek(now, { locale: zhCN }).toISOString(), end: endOfWeek(now, { locale: zhCN }).toISOString() }
}

export function getMonthRange() {
  const now = new Date()
  return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() }
}

export function getDayOfWeekLabel(date: string | Date): string {
  const d = new Date(date)
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[d.getDay()]
}

export function groupByDay<T extends { created_at: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const day = format(new Date(item.created_at), 'yyyy-MM-dd')
    if (!groups[day]) groups[day] = []
    groups[day].push(item)
  }
  return groups
}

/**
 * 道格拉斯-普克轨迹抽稀算法
 * @param points 轨迹点数组
 * @param tolerance 距离阈值（米）
 */
export function simplifyTrack(
  points: Array<{ latitude: number; longitude: number }>,
  tolerance: number = 10
): Array<{ latitude: number; longitude: number }> {
  if (points.length <= 2) return points

  function perpendicularDistance(
    point: { latitude: number; longitude: number },
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ): number {
    const d = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude)
    if (d === 0) return calculateDistance(point.latitude, point.longitude, start.latitude, start.longitude)
    const t =
      ((point.latitude - start.latitude) * (end.latitude - start.latitude) +
        (point.longitude - start.longitude) * (end.longitude - start.longitude)) /
      (d * d)
    const lat = start.latitude + t * (end.latitude - start.latitude)
    const lng = start.longitude + t * (end.longitude - start.longitude)
    return calculateDistance(point.latitude, point.longitude, lat, lng)
  }

  function douglasPeucker(
    pts: Array<{ latitude: number; longitude: number }>,
    tol: number
  ): Array<{ latitude: number; longitude: number }> {
    if (pts.length <= 2) return pts

    let maxDist = 0
    let index = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1])
      if (dist > maxDist) {
        maxDist = dist
        index = i
      }
    }

    if (maxDist > tol) {
      const left = douglasPeucker(pts.slice(0, index + 1), tol)
      const right = douglasPeucker(pts.slice(index), tol)
      return [...left.slice(0, -1), ...right]
    }

    return [pts[0], pts[pts.length - 1]]
  }

  return douglasPeucker(points, tolerance)
}
