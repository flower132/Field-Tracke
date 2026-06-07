import { Route, Clock, MapPin, ClipboardCheck, ChevronRight } from 'lucide-react'
import { formatDistance, formatDuration } from '../utils/helpers'

interface Props {
  title: string
  mileage: number
  onlineMinutes: number
  checkins: number
  complaints: number
  onClick?: () => void
}

export default function PeriodOverviewCard({
  title,
  mileage,
  onlineMinutes,
  checkins,
  complaints,
  onClick,
}: Props) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-800/50 bg-slate-900 p-4 text-left transition-colors active:bg-slate-800"
    >
      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Route size={12} className="text-primary-400" />
            {formatDistance(mileage)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock size={12} className="text-slate-500" />
            {formatDuration(onlineMinutes)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin size={12} className="text-amber-400" />
            {checkins}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ClipboardCheck size={12} className="text-rose-400" />
            {complaints}
          </div>
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-600" />
    </button>
  )
}
