import { format, startOfDay, endOfDay, subDays } from 'date-fns'
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
