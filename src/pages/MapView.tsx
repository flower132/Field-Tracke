import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { Layers, X, Navigation, Battery, Gauge } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { useAuthStore } from '../store/authStore'
import { getUsers, getLatestTracks, getCheckins, getTracksByUser } from '../api/supabase'
import { getTodayRange, formatDistance, calculatePolylineDistance, formatDateTime } from '../utils/helpers'
import { getUserColor } from '../utils/constants'
import type { Track, User } from '../types'
import L from 'leaflet'

// Fix Leaflet icon paths
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function createUserIcon(color: string) {
  return L.divIcon({
    className: 'pulse-marker',
    html: `<div style="color:${color};width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 0 2px ${color}40;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  })
}

function createCheckinIcon(seq: number) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:#f59e0b;color:#0f172a;font-weight:700;font-size:12px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${seq}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

function MapController() {
  const map = useMap()
  const { selectedUserId } = useMapStore()

  useEffect(() => {
    if (selectedUserId && map) {
      // Will be handled by selected track data
    }
  }, [selectedUserId, map])

  return null
}

export default function MapView() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const { activeLayers, selectedUserId, setSelectedUserId } = useMapStore()
  const [showLayerPanel, setShowLayerPanel] = useState(false)

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await getUsers()
      return data || []
    },
    enabled: isAdmin,
  })

  const { data: latestTracks } = useQuery({
    queryKey: ['latest-tracks'],
    queryFn: async () => {
      const { data } = await getLatestTracks()
      return data || []
    },
    refetchInterval: 30000,
  })

  const { data: todayCheckins } = useQuery({
    queryKey: ['checkins', 'today'],
    queryFn: async () => {
      const range = getTodayRange()
      const { data } = await getCheckins(range.start, range.end)
      return data || []
    },
  })

  const { data: selectedTracks } = useQuery({
    queryKey: ['tracks', selectedUserId, 'today'],
    queryFn: async () => {
      if (!selectedUserId) return []
      const range = getTodayRange()
      const { data } = await getTracksByUser(selectedUserId, range.start, range.end)
      return data || []
    },
    enabled: !!selectedUserId,
  })

  const userMap = useMemo(() => {
    const map = new Map<string, User>()
    ;(users || []).forEach((u) => map.set(u.id, u))
    return map
  }, [users])

  const latestByUser = useMemo(() => {
    const map = new Map<string, Track & { user?: User }>()
    ;(latestTracks || []).forEach((t) => {
      const existing = map.get(t.user_id)
      if (!existing || new Date(t.created_at) > new Date(existing.created_at)) {
        map.set(t.user_id, { ...t, user: userMap.get(t.user_id) })
      }
    })
    return Array.from(map.values())
  }, [latestTracks, userMap])

  const todayMileage = useMemo(() => {
    if (!selectedTracks || selectedTracks.length === 0) return 0
    return calculatePolylineDistance(selectedTracks)
  }, [selectedTracks])

  const layerOptions = [
    { key: 'realtime' as const, label: '实时位置' },
    { key: 'tracks' as const, label: '轨迹' },
    { key: 'checkins' as const, label: '打卡点' },
  ]

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[39.9042, 116.4074]}
        zoom={12}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController />

        {activeLayers.includes('realtime') &&
          latestByUser.map((track, idx) => (
            <Marker
              key={track.user_id}
              position={[track.latitude, track.longitude]}
              icon={createUserIcon(getUserColor(idx))}
              eventHandlers={{
                click: () => setSelectedUserId(track.user_id),
              }}
            >
              <Popup>
                <div className="min-w-[160px] space-y-1 p-1">
                  <div className="font-semibold text-slate-100">{track.user?.name || '未知人员'}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    在线
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Gauge size={12} />
                    {track.speed?.toFixed(1) || 0} km/h
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Battery size={12} />
                    {track.battery || '--'}%
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(track.created_at)}</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {activeLayers.includes('tracks') && selectedTracks && selectedTracks.length > 1 && (
          <Polyline
            positions={selectedTracks.map((t) => [t.latitude, t.longitude])}
            color="#3b82f6"
            weight={3}
            opacity={0.8}
          />
        )}

        {activeLayers.includes('checkins') &&
          (todayCheckins || []).map((c) => (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={createCheckinIcon(c.sequence_no)}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1 p-1">
                  <div className="font-semibold text-slate-100">打卡 #{c.sequence_no}</div>
                  <div className="text-xs text-slate-400">{c.user?.name || '未知'}</div>
                  <div className="text-xs text-slate-500">{c.address}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(c.created_at)}</div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Layer toggle */}
      <button
        onClick={() => setShowLayerPanel(!showLayerPanel)}
        className="absolute right-4 top-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 text-slate-300 shadow-lg backdrop-blur active:bg-slate-800"
      >
        <Layers size={20} />
      </button>

      {/* User list (admin only) */}
      {isAdmin && (
        <div className="absolute left-4 top-4 z-[1000] max-h-[50%] w-40 overflow-y-auto rounded-xl bg-slate-900/90 shadow-lg backdrop-blur">
          <div className="p-2 text-xs font-semibold text-slate-400">在线人员</div>
          {latestByUser.map((track, idx) => (
            <button
              key={track.user_id}
              onClick={() => setSelectedUserId(track.user_id === selectedUserId ? null : track.user_id)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                selectedUserId === track.user_id ? 'bg-primary-500/20 text-primary-300' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: getUserColor(idx) }} />
              <span className="truncate">{track.user?.name || '未知'}</span>
            </button>
          ))}
        </div>
      )}

      {/* Layer panel */}
      {showLayerPanel && (
        <div className="absolute right-4 top-16 z-[1000] w-36 rounded-xl bg-slate-900/95 py-2 shadow-lg backdrop-blur">
          {layerOptions.map((layer) => (
            <button
              key={layer.key}
              onClick={() => useMapStore.getState().toggleLayer(layer.key)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-slate-300"
            >
              {layer.label}
              {activeLayers.includes(layer.key) && (
                <div className="h-2 w-2 rounded-full bg-primary-400" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected user detail */}
      {selectedUserId && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] rounded-2xl bg-slate-900/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-100">
                {userMap.get(selectedUserId)?.name || '未知人员'}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Navigation size={12} /> {todayMileage > 0 ? formatDistance(todayMileage) : '--'}</span>
                <span className="flex items-center gap-1"><Battery size={12} /> {(latestByUser.find((t) => t.user_id === selectedUserId)?.battery || '--')}%</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedUserId(null)}
              className="rounded-lg bg-slate-800 p-1.5 text-slate-400"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
