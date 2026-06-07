import { useEffect, useMemo, useState } from 'react'
import { Marker, useMap } from 'react-leaflet'
import L from 'leaflet'

interface ClusterPoint {
  id: string
  latitude: number
  longitude: number
  sequence_no: number
  isComplaint: boolean
}

interface Props {
  points: ClusterPoint[]
  zoomThreshold?: number
  renderMarker: (point: ClusterPoint) => React.ReactNode
}

function createClusterIcon(count: number) {
  return L.divIcon({
    className: 'custom-cluster-icon',
    html: `<div style="background:#3b82f6;color:#fff;font-weight:700;font-size:13px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

export default function MapMarkerCluster({
  points,
  zoomThreshold = 15,
  renderMarker,
}: Props) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())

  useEffect(() => {
    const handler = () => setZoom(map.getZoom())
    map.on('zoomend', handler)
    return () => {
      map.off('zoomend', handler)
    }
  }, [map])

  const clusters = useMemo(() => {
    if (zoom >= zoomThreshold) return null

    // 简单网格聚合
    const gridSize = 0.005 // 约500米
    const grid = new Map<string, ClusterPoint[]>()

    for (const p of points) {
      const gx = Math.floor(p.latitude / gridSize)
      const gy = Math.floor(p.longitude / gridSize)
      const key = `${gx},${gy}`
      if (!grid.has(key)) grid.set(key, [])
      grid.get(key)!.push(p)
    }

    return Array.from(grid.entries()).map(([key, pts]) => ({
      key,
      lat: pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
      count: pts.length,
      points: pts,
    }))
  }, [points, zoom, zoomThreshold])

  if (zoom >= zoomThreshold) {
    return <>{points.map((p) => <div key={p.id}>{renderMarker(p)}</div>)}</>
  }

  return (
    <>
      {clusters?.map((c) => (
        <Marker
          key={c.key}
          position={[c.lat, c.lng]}
          icon={createClusterIcon(c.count)}
          eventHandlers={{
            click: () => {
              map.flyTo([c.lat, c.lng], zoomThreshold)
            },
          }}
        />
      ))}
    </>
  )
}
