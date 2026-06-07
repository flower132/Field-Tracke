import { useMapStore } from '../store/mapStore'
import { Eye, EyeOff } from 'lucide-react'

export default function MapLegend() {
  const { showLegend, toggleLegend } = useMapStore()

  if (!showLegend) {
    return (
      <button
        onClick={toggleLegend}
        className="absolute left-4 bottom-24 z-[1000] rounded-lg bg-slate-900/90 p-2 text-slate-400 shadow-lg backdrop-blur"
        title="显示图例"
      >
        <Eye size={16} />
      </button>
    )
  }

  const items = [
    { key: 'current', label: '当前位置', color: '#10b981', shape: 'circle' as const },
    { key: 'track', label: '轨迹', color: '#3b82f6', shape: 'line' as const },
    { key: 'checkin', label: '打卡点', color: '#f59e0b', shape: 'numbered' as const },
    { key: 'complaint', label: '投诉点', color: '#ef4444', shape: 'circle' as const },
  ]

  return (
    <div className="absolute left-4 bottom-24 z-[1000] rounded-xl bg-slate-900/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500">图例</span>
        <button onClick={toggleLegend} className="text-slate-500">
          <EyeOff size={12} />
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            {item.shape === 'circle' && (
              <div
                className="h-2.5 w-2.5 rounded-full border border-white/20"
                style={{ background: item.color }}
              />
            )}
            {item.shape === 'line' && (
              <div className="h-0.5 w-4 rounded" style={{ background: item.color }} />
            )}
            {item.shape === 'numbered' && (
              <div
                className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold"
                style={{ background: item.color, color: '#0f172a' }}
              >
                ①
              </div>
            )}
            <span className="text-[10px] text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
