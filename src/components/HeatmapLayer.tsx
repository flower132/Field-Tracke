import { useEffect, useMemo } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

export interface HeatPoint {
  latitude: number
  longitude: number
  intensity?: number
}

interface HeatmapLayerProps {
  points: HeatPoint[]
  radius?: number
  blur?: number
  maxZoom?: number
  max?: number
  minOpacity?: number
  gradient?: Record<number, string>
}

export default function HeatmapLayer({
  points,
  radius = 25,
  blur = 15,
  maxZoom,
  max,
  minOpacity = 0.05,
  gradient,
}: HeatmapLayerProps) {
  const map = useMap()

  const computedMax = useMemo(() => {
    if (max != null) return max
    if (points.length === 0) return 1
    const peak = Math.max(...points.map((p) => p.intensity ?? 1))
    return Math.max(1, peak)
  }, [points, max])

  useEffect(() => {
    if (!map || points.length === 0) return

    const latlngs = points.map(
      (p) => [p.latitude, p.longitude, p.intensity ?? 1] as [number, number, number],
    )

    const layer = L.heatLayer(latlngs, {
      radius,
      blur,
      maxZoom,
      max: computedMax,
      minOpacity,
      gradient,
    }).addTo(map)

    return () => {
      map.removeLayer(layer)
    }
  }, [map, points, radius, blur, maxZoom, computedMax, minOpacity, gradient])

  return null
}
