import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import {
  Layers,
  X,
  Navigation,
  Battery,
  Gauge,
  Crosshair,
  MapPin,
  Image as ImageIcon,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import { useMapStore } from '../store/mapStore'
import { useLocationStore } from '../store/locationStore'
import { useAuthStore } from '../store/authStore'
import { useRealtime } from '../hooks/useRealtime'
import {
  getUsers,
  getLatestTracks,
  getCheckins,
  getCheckinsByUser,
  getTracksByUser,
} from '../api/supabase'
import {
  getTodayRange,
  formatDistance,
  formatDateTime,
  formatDate,
  calculatePolylineDistance,
  simplifyTrack,
} from '../utils/helpers'
import { getUserColor, BASE_MAPS } from '../utils/constants'
import HeatmapLayer from '../components/HeatmapLayer'
import MapLayerControl from '../components/MapLayerControl'
import MapLegend from '../components/MapLegend'
import type { Track, User, Checkin } from '../types'
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

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']

function createCheckinIcon(seq: number, isComplaint: boolean) {
  const bg = isComplaint ? '#ef4444' : '#f59e0b'
  const label = CIRCLED_NUMBERS[seq - 1] || seq
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:${bg};color:#fff;font-weight:700;font-size:12px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

/* ============================================================
   地图初始化修复：invalidateSize
   ============================================================ */
function MapInitializer() {
  const map = useMap()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      setTimeout(() => map.invalidateSize(), 150)
    }
  }, [map])

  useEffect(() => {
    // 路由切换/页面显示后重新计算地图尺寸
    const handle = () => {
      requestAnimationFrame(() => {
        setTimeout(() => map.invalidateSize(), 200)
      })
    }
    window.addEventListener('resize', handle)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) handle()
    })
    // 额外兜底：mount 后再次触发
    const t1 = setTimeout(() => map.invalidateSize(), 300)
    const t2 = setTimeout(() => map.invalidateSize(), 800)
    return () => {
      window.removeEventListener('resize', handle)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [map])

  return null
}

/* ============================================================
   自动适配显示范围
   ============================================================ */
function MapFitBounds({
  tracks,
  checkins,
}: {
  tracks?: Track[]
  checkins?: Checkin[]
}) {
  const map = useMap()

  useEffect(() => {
    const points: L.LatLngExpression[] = []
    if (tracks && tracks.length > 0) {
      tracks.forEach((t) => points.push([t.latitude, t.longitude]))
    }
    if (checkins && checkins.length > 0) {
      checkins.forEach((c) => points.push([c.latitude, c.longitude]))
    }
    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
  }, [map, tracks, checkins])

  return null
}

/* ============================================================
   跟随当前位置
   ============================================================ */
function MapFollower({ enabled }: { enabled: boolean }) {
  const map = useMap()
  const { latitude, longitude } = useLocationStore()

  useEffect(() => {
    if (enabled && latitude && longitude) {
      map.panTo([latitude, longitude], { animate: true, duration: 0.5 })
    }
  }, [enabled, latitude, longitude, map])

  return null
}

/* ============================================================
   定位到当前位置（一次性）
   ============================================================ */
function MapLocator({ trigger }: { trigger: number }) {
  const map = useMap()
  const { latitude, longitude } = useLocationStore()

  useEffect(() => {
    if (trigger > 0 && latitude && longitude) {
      map.flyTo([latitude, longitude], 16, { duration: 0.8 })
    }
  }, [trigger, latitude, longitude, map])

  return null
}

/* ============================================================
   打卡点 Popup 内容（含照片缩略图）
   ============================================================ */
function CheckinPopup({ checkin, isAdmin }: { checkin: Checkin; isAdmin: boolean }) {
  return (
    <div className="min-w-[240px] max-w-[300px] space-y-2 p-1">
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: checkin.complaint_content?.trim() ? '#ef4444' : '#f59e0b',
            color: '#fff',
          }}
        >
          {checkin.sequence_no}
        </div>
        <div className="min-w-0 flex-1 truncate font-semibold text-slate-100">
          {checkin.title || `打卡 #${checkin.sequence_no}`}
        </div>
      </div>

      {isAdmin && (
        <div className="text-xs text-slate-400">{checkin.user?.name || '未知人员'}</div>
      )}

      <div className="flex items-center gap-1 text-xs text-slate-500">
        <MapPin size={12} />
        <span className="line-clamp-2">{checkin.address}</span>
      </div>

      <div className="flex items-center gap-1 text-xs text-slate-500">
        <ChevronRight size={12} className="rotate-0" />
        {formatDateTime(checkin.created_at)}
      </div>

      {checkin.complaint_content && (
        <div className="rounded-lg bg-rose-500/10 p-2">
          <div className="text-[10px] font-medium text-rose-400">投诉内容</div>
          <div className="mt-0.5 text-xs text-rose-200">{checkin.complaint_content}</div>
        </div>
      )}

      {checkin.test_result && (
        <div className="rounded-lg bg-emerald-500/10 p-2">
          <div className="text-[10px] font-medium text-emerald-400">测试结果</div>
          <div className="mt-0.5 text-xs text-emerald-200">{checkin.test_result}</div>
        </div>
      )}

      {checkin.solution_result && (
        <div className="rounded-lg bg-slate-800/60 p-2">
          <div className="text-[10px] font-medium text-slate-500">处理结果</div>
          <div className="mt-0.5 text-xs text-slate-300">{checkin.solution_result}</div>
        </div>
      )}

      {checkin.photos && checkin.photos.length > 0 && (
        <PhotoProvider>
          <div className="flex gap-1.5 overflow-x-auto pt-1">
            {checkin.photos.map((p) => (
              <PhotoView key={p.id} src={p.photo_url}>
                <img
                  src={p.photo_url}
                  alt=""
                  className="h-16 w-16 shrink-0 cursor-pointer rounded-md object-cover"
                  loading="lazy"
                />
              </PhotoView>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <ImageIcon size={10} />
            {checkin.photos.length} 张照片
          </div>
        </PhotoProvider>
      )}
    </div>
  )
}

/* ============================================================
   主组件
   ============================================================ */
export default function MapView() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const { latitude, longitude } = useLocationStore()
  const {
    activeLayers,
    baseMap,
    selectedUserId,
    setSelectedUserId,
    followMode,
    setFollowMode,
  } = useMapStore()
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [locateTrigger, setLocateTrigger] = useState(0)
  const [mapDate, setMapDate] = useState(formatDate(new Date()))

  const baseMapConfig = useMemo(
    () => BASE_MAPS.find((m) => m.key === baseMap) || BASE_MAPS[0],
    [baseMap]
  )

  const { isConnected } = useRealtime()

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
    refetchInterval: isConnected ? false : 30000,
  })

  const dateRange = useMemo(() => {
    const start = `${mapDate}T00:00:00`
    const end = `${mapDate}T23:59:59`
    return { start, end }
  }, [mapDate])

  const { data: allCheckins } = useQuery({
    queryKey: ['checkins', 'map', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await getCheckins(dateRange.start, dateRange.end)
      return data || []
    },
  })

  const { data: myCheckins } = useQuery({
    queryKey: ['checkins', 'mine', 'today'],
    queryFn: async () => {
      if (!user) return []
      const range = getTodayRange()
      const { data } = await getCheckinsByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !isAdmin && !!user,
  })

  // 管理员：选中人员的轨迹
  const { data: selectedTracks } = useQuery({
    queryKey: ['tracks', selectedUserId, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!selectedUserId) return []
      const { data } = await getTracksByUser(selectedUserId, dateRange.start, dateRange.end)
      return data || []
    },
    enabled: !!selectedUserId,
  })

  // 管理员：所有人员的今日轨迹
  const { data: allTracks } = useQuery({
    queryKey: ['tracks', 'all', dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await getCheckins(dateRange.start, dateRange.end)
      // 获取所有人员的轨迹
      const userIds = [...new Set((data || []).map((c) => c.user_id))]
      const results: Record<string, Track[]> = {}
      for (const uid of userIds) {
        const { data: t } = await getTracksByUser(uid, dateRange.start, dateRange.end)
        results[uid] = t || []
      }
      return results
    },
    enabled: isAdmin,
  })

  const { data: myTracks } = useQuery({
    queryKey: ['tracks', 'mine', 'today'],
    queryFn: async () => {
      if (!user) return []
      const range = getTodayRange()
      const { data } = await getTracksByUser(user.id, range.start, range.end)
      return data || []
    },
    enabled: !isAdmin && !!user,
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

  // 可见数据
  const visibleCheckins: Checkin[] = isAdmin
    ? (allCheckins || [])
    : (myCheckins || [])

  // 测试人员只看自己的轨迹
  const myVisibleTracks: Track[] = myTracks || []

  const todayMileage = useMemo(() => {
    if (!selectedTracks || selectedTracks.length === 0) return 0
    return calculatePolylineDistance(selectedTracks)
  }, [selectedTracks])

  const heatPoints = useMemo(() => {
    return (visibleCheckins || []).map((c: Checkin) => ({
      latitude: c.latitude,
      longitude: c.longitude,
      intensity: c.complaint_content?.trim() ? 1 : 0.3,
    }))
  }, [visibleCheckins])

  const layerOptions = [
    { key: 'realtime' as const, label: '实时位置' },
    { key: 'tracks' as const, label: '轨迹' },
    { key: 'checkins' as const, label: '打卡点' },
    { key: 'heat' as const, label: '热力图' },
  ]

  const effectiveLayers = isAdmin ? activeLayers : ['tracks', 'checkins']

  const handleLocate = useCallback(() => {
    setLocateTrigger((t) => t + 1)
  }, [])

  const handleToggleFollow = useCallback(() => {
    setFollowMode(!followMode)
  }, [followMode, setFollowMode])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[latitude || 39.9042, longitude || 116.4074]}
        zoom={12}
        className="h-full w-full"
        zoomControl={false}
      >
        <MapInitializer />
        <TileLayer
          attribution={baseMapConfig.attribution}
          url={baseMapConfig.url}
          key={baseMapConfig.key}
        />
        <MapFitBounds
          tracks={isAdmin ? undefined : myVisibleTracks}
          checkins={visibleCheckins}
        />
        <MapFollower enabled={followMode} />
        <MapLocator trigger={locateTrigger} />

        {/* 管理员：实时位置（全员） */}
        {isAdmin &&
          effectiveLayers.includes('realtime') &&
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
                  <div className="font-semibold text-slate-100">
                    {track.user?.name || '未知人员'}
                  </div>
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
                  <div className="text-xs text-slate-500">
                    {formatDateTime(track.created_at)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* 管理员：所有人员轨迹（不同颜色） */}
        {isAdmin &&
          effectiveLayers.includes('tracks') &&
          allTracks &&
          Object.entries(allTracks).map(([uid, tracks]) => {
            if (!tracks || tracks.length < 2) return null
            const userIdx = (users || []).findIndex((u) => u.id === uid)
            const color = getUserColor(userIdx >= 0 ? userIdx : 0)
            const simplified =
              tracks.length > 500 ? simplifyTrack(tracks, 15) : tracks
            return (
              <Polyline
                key={uid}
                positions={simplified.map((t) => [t.latitude, t.longitude])}
                color={color}
                weight={2.5}
                opacity={0.7}
              />
            )
          })}

        {/* 测试人员：自己的轨迹 */}
        {!isAdmin &&
          effectiveLayers.includes('tracks') &&
          myVisibleTracks &&
          myVisibleTracks.length > 1 && (
            <>
              <Polyline
                positions={myVisibleTracks.map((t) => [t.latitude, t.longitude])}
                color="#3b82f6"
                weight={3}
                opacity={0.8}
              />
              <Marker
                position={[
                  myVisibleTracks[0].latitude,
                  myVisibleTracks[0].longitude,
                ]}
              >
                <Popup>
                  <div className="text-xs text-slate-500">
                    起点 {formatDateTime(myVisibleTracks[0].created_at)}
                  </div>
                </Popup>
              </Marker>
              <Marker
                position={[
                  myVisibleTracks[myVisibleTracks.length - 1].latitude,
                  myVisibleTracks[myVisibleTracks.length - 1].longitude,
                ]}
              >
                <Popup>
                  <div className="text-xs text-slate-500">
                    终点{' '}
                    {formatDateTime(
                      myVisibleTracks[myVisibleTracks.length - 1].created_at
                    )}
                  </div>
                </Popup>
              </Marker>
            </>
          )}

        {/* 打卡点 */}
        {effectiveLayers.includes('checkins') &&
          visibleCheckins.map((c) => (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={createCheckinIcon(
                c.sequence_no,
                !!c.complaint_content?.trim()
              )}
            >
              <Popup>
                <CheckinPopup checkin={c} isAdmin={isAdmin} />
              </Popup>
            </Marker>
          ))}

        {/* 热力图（仅管理员） */}
        {isAdmin && effectiveLayers.includes('heat') && heatPoints.length > 0 && (
          <HeatmapLayer
            points={heatPoints}
            radius={28}
            blur={18}
            minOpacity={0.25}
            gradient={{
              0.2: '#3b82f6',
              0.45: '#10b981',
              0.7: '#f59e0b',
              0.9: '#ef4444',
              1.0: '#7f1d1d',
            }}
          />
        )}

        {/* 当前位置标记 */}
        {latitude && longitude && (
          <Marker
            position={[latitude, longitude]}
            icon={L.divIcon({
              className: 'current-location-marker',
              html: `<div style="width:16px;height:16px;background:#10b981;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #10b98160;animation:pulse 2s infinite;"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          >
            <Popup>
              <div className="text-xs text-slate-300">
                当前位置
                <br />
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* 底图切换 */}
      <MapLayerControl />

      {/* 地图图例 */}
      <MapLegend />

      {/* 浮动按钮组（定位 + 跟随） */}
      <div className="absolute right-4 bottom-24 z-[1000] flex flex-col gap-2">
        <button
          onClick={handleToggleFollow}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg backdrop-blur transition-colors ${
            followMode
              ? 'bg-primary-500 text-white'
              : 'bg-slate-900/90 text-slate-300 active:bg-slate-800'
          }`}
          title={followMode ? '关闭跟随' : '跟随当前位置'}
        >
          <Navigation size={20} />
        </button>
        <button
          onClick={handleLocate}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/90 text-slate-300 shadow-lg backdrop-blur active:bg-slate-800"
          title="定位到当前位置"
        >
          <Crosshair size={20} />
        </button>
      </div>

      {/* 管理员控件 */}
      {isAdmin && (
        <>
          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            className="absolute right-4 top-40 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/90 text-slate-300 shadow-lg backdrop-blur active:bg-slate-800"
          >
            <Layers size={20} />
          </button>

          {/* 日期选择 */}
          <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 rounded-xl bg-slate-900/90 px-3 py-2 shadow-lg backdrop-blur">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={mapDate}
              onChange={(e) => setMapDate(e.target.value)}
              className="border-none bg-transparent text-xs text-slate-200 outline-none"
            />
          </div>

          {/* User list */}
          <div className="absolute left-4 top-14 z-[1000] max-h-[40%] w-44 overflow-y-auto rounded-xl bg-slate-900/90 shadow-lg backdrop-blur">
            <div className="p-2 text-xs font-semibold text-slate-400">在线人员</div>
            {latestByUser.map((track, idx) => (
              <button
                key={track.user_id}
                onClick={() =>
                  setSelectedUserId(
                    track.user_id === selectedUserId ? null : track.user_id
                  )
                }
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  selectedUserId === track.user_id
                    ? 'bg-primary-500/20 text-primary-300'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: getUserColor(idx) }}
                />
                <span className="truncate">
                  {track.user?.name || '未知'}
                </span>
              </button>
            ))}
          </div>

          {/* Layer panel */}
          {showLayerPanel && (
            <div className="absolute right-4 top-56 z-[1000] w-36 rounded-xl bg-slate-900/95 py-2 shadow-lg backdrop-blur">
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
            <div className="absolute bottom-4 left-4 right-4 z-[1000] rounded-2xl border border-slate-800/50 bg-slate-900/95 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100">
                    {userMap.get(selectedUserId)?.name || '未知人员'}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Navigation size={12} />{' '}
                      {todayMileage > 0 ? formatDistance(todayMileage) : '--'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Battery size={12} />{' '}
                      {
                        latestByUser.find(
                          (t) => t.user_id === selectedUserId
                        )?.battery || '--'
                      }
                      %
                    </span>
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
        </>
      )}

      {/* 测试人员：顶部标题栏 + 跟随提示 */}
      {!isAdmin && (
        <div className="absolute left-4 top-4 z-[1000] space-y-2">
          <div className="rounded-xl bg-slate-900/90 px-3 py-2 shadow-lg backdrop-blur">
            <div className="text-sm font-semibold text-slate-100">我的轨迹</div>
            <div className="text-xs text-slate-500">
              {myTracks && myTracks.length > 0
                ? `今日轨迹 ${formatDistance(
                    calculatePolylineDistance(myTracks)
                  )}`
                : '暂无轨迹数据'}
            </div>
          </div>
          {followMode && (
            <div className="flex items-center gap-1.5 rounded-full bg-primary-500/90 px-3 py-1 text-xs text-white shadow-lg backdrop-blur">
              <Navigation size={12} />
              跟随中
            </div>
          )}
        </div>
      )}
    </div>
  )
}
