import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { Play, Pause, SkipBack, SkipForward, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { getUsers, getTracksByUser } from '../api/supabase'
import { formatDate, formatTime, formatDistance, calculatePolylineDistance } from '../utils/helpers'
import { getUserColor } from '../utils/constants'
import L from 'leaflet'

function createMovingIcon(color: string) {
  return L.divIcon({
    className: 'moving-marker',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px ${color}80;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function MapFollower({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    if (map) {
      map.panTo(position, { animate: true, duration: 0.3 })
    }
  }, [position, map])
  return null
}

export default function TrackPlayback() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id || '')
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showUserSelect, setShowUserSelect] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await getUsers()
      return data || []
    },
    enabled: isAdmin,
  })

  const { data: tracks } = useQuery({
    queryKey: ['tracks', selectedUserId, selectedDate],
    queryFn: async () => {
      if (!selectedUserId) return []
      const start = `${selectedDate}T00:00:00`
      const end = `${selectedDate}T23:59:59`
      const { data } = await getTracksByUser(selectedUserId, start, end)
      return data || []
    },
    enabled: !!selectedUserId,
  })

  const points = useMemo(() => {
    return (tracks || []).map((t) => [t.latitude, t.longitude] as [number, number])
  }, [tracks])

  const totalDistance = useMemo(() => {
    if (!tracks) return 0
    return calculatePolylineDistance(tracks)
  }, [tracks])

  const currentTrack = tracks?.[currentIndex]
  const progress = tracks && tracks.length > 0 ? ((currentIndex + 1) / tracks.length) * 100 : 0

  const userColor = useMemo(() => {
    const idx = (users || []).findIndex((u) => u.id === selectedUserId)
    return getUserColor(idx >= 0 ? idx : 0)
  }, [users, selectedUserId])

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isPlaying && tracks && tracks.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= tracks.length - 1) {
            stopPlayback()
            return prev
          }
          return prev + 1
        })
      }, Math.max(200, 1000 / speed))
    } else {
      stopPlayback()
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, tracks, speed, stopPlayback])

  const handlePlay = () => {
    if (!tracks || tracks.length === 0) return
    if (currentIndex >= tracks.length - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value)
    if (tracks) {
      const idx = Math.floor((val / 100) * (tracks.length - 1))
      setCurrentIndex(idx)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-100">轨迹回放</h1>
        <div className="mt-2 flex items-center gap-2">
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setShowUserSelect(!showUserSelect)}
                className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300"
              >
                {(users || []).find((u) => u.id === selectedUserId)?.name || '选择人员'}
                <ChevronDown size={14} />
              </button>
              {showUserSelect && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-40 w-32 overflow-y-auto rounded-lg bg-slate-800 shadow-lg">
                  {(users || []).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserId(u.id)
                        setShowUserSelect(false)
                        setCurrentIndex(0)
                        setIsPlaying(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setCurrentIndex(0)
              setIsPlaying(false)
            }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100"
          />
        </div>
      </div>

      <div className="flex-1 relative">
        <MapContainer center={[39.9042, 116.4074]} zoom={12} className="h-full w-full" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.length > 1 && (
            <>
              <Polyline positions={points} color="#334155" weight={2} opacity={0.5} />
              <Polyline
                positions={points.slice(0, currentIndex + 1)}
                color={userColor}
                weight={3}
                opacity={0.9}
              />
            </>
          )}
          {currentTrack && (
            <>
              <Marker position={[currentTrack.latitude, currentTrack.longitude]} icon={createMovingIcon(userColor)} />
              <MapFollower position={[currentTrack.latitude, currentTrack.longitude]} />
            </>
          )}
        </MapContainer>
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>{tracks?.length ? formatTime(tracks[0].created_at) : '--:--:--'}</span>
          <span>{currentTrack ? formatTime(currentTrack.created_at) : '--:--:--'}</span>
          <span>{tracks?.length ? formatTime(tracks[tracks.length - 1].created_at) : '--:--:--'}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={handleSeek}
          className="w-full accent-primary-500"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIndex(0)}
              className="rounded-lg bg-slate-800 p-2 text-slate-300"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={handlePlay}
              disabled={!tracks || tracks.length === 0}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white disabled:opacity-50"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={() => {
                if (tracks) setCurrentIndex(tracks.length - 1)
              }}
              className="rounded-lg bg-slate-800 p-2 text-slate-300"
            >
              <SkipForward size={18} />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  speed === s ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>总里程: {formatDistance(totalDistance)}</span>
          <span>速度: {currentTrack?.speed?.toFixed(1) || 0} km/h</span>
        </div>
      </div>
    </div>
  )
}
