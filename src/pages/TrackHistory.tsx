import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { getTracksByUser } from '../api/supabase'
import { getTodayRange, getYesterdayRange, getLast7DaysRange, formatDate, formatDistance, calculatePolylineDistance } from '../utils/helpers'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function MapFitter({ points }: { points: [number, number][] }) {
  const map = useMap()
  if (points.length > 0 && map) {
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40] })
  }
  return null
}

export default function TrackHistory() {
  const { user } = useAuthStore()
  const [rangeType, setRangeType] = useState<'today' | 'yesterday' | '7days' | 'custom'>('today')
  const [customDate, setCustomDate] = useState(formatDate(new Date()))

  const dateRange = useMemo(() => {
    switch (rangeType) {
      case 'today': return getTodayRange()
      case 'yesterday': return getYesterdayRange()
      case '7days': return getLast7DaysRange()
      case 'custom': {
        const d = new Date(customDate)
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString()
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
        return { start, end }
      }
    }
  }, [rangeType, customDate])

  const { data: tracks } = useQuery({
    queryKey: ['tracks', user?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!user) return []
      const { data } = await getTracksByUser(user.id, dateRange.start, dateRange.end)
      return data || []
    },
    enabled: !!user,
  })

  const points = useMemo(() => {
    return (tracks || []).map((t) => [t.latitude, t.longitude] as [number, number])
  }, [tracks])

  const totalDistance = useMemo(() => {
    if (!tracks) return 0
    return calculatePolylineDistance(tracks)
  }, [tracks])

  const rangeOptions = [
    { key: 'today' as const, label: '今日' },
    { key: 'yesterday' as const, label: '昨日' },
    { key: '7days' as const, label: '7天' },
    { key: 'custom' as const, label: '自定义' },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-100">轨迹记录</h1>
        <div className="mt-2 flex items-center gap-2">
          {rangeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRangeType(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                rangeType === opt.key ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {rangeType === 'custom' && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        )}
      </div>

      <div className="flex-1">
        <MapContainer center={[39.9042, 116.4074]} zoom={12} className="h-full w-full" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.length > 1 && (
            <>
              <Polyline positions={points} color="#3b82f6" weight={3} opacity={0.8} />
              <Marker position={points[0]} icon={DefaultIcon} />
              <MapFitter points={points} />
            </>
          )}
        </MapContainer>
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">轨迹点数</span>
          <span className="font-medium text-slate-200">{tracks?.length || 0}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-slate-400">总里程</span>
          <span className="font-medium text-slate-200">{formatDistance(totalDistance)}</span>
        </div>
      </div>
    </div>
  )
}
