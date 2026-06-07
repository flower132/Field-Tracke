import { Map, Satellite, Mountain, X } from 'lucide-react'
import { useMapStore } from '../store/mapStore'
import { BASE_MAPS } from '../utils/constants'
import type { BaseMapType } from '../types'

const icons: Record<BaseMapType, React.ReactNode> = {
  osm: <Map size={14} />,
  esri: <Satellite size={14} />,
  topo: <Mountain size={14} />,
}

export default function MapLayerControl() {
  const { baseMap, setBaseMap } = useMapStore()

  return (
    <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
      <div className="flex flex-col gap-1.5 rounded-xl bg-slate-900/95 p-2 shadow-lg backdrop-blur">
        {BASE_MAPS.map((m) => (
          <button
            key={m.key}
            onClick={() => setBaseMap(m.key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              baseMap === m.key
                ? 'bg-primary-600 text-white'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {icons[m.key]}
            {m.name}
          </button>
        ))}
      </div>
    </div>
  )
}
