import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { List, Map, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { getCheckins } from '../api/supabase'
import { getTodayRange, formatDateTime } from '../utils/helpers'
import type { Checkin } from '../types'
import L from 'leaflet'

function createCheckinIcon(seq: number) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:#f59e0b;color:#0f172a;font-weight:700;font-size:12px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${seq}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

export default function CheckinList() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [search, setSearch] = useState('')

  const { data: checkins } = useQuery({
    queryKey: ['checkins', 'all'],
    queryFn: async () => {
      const range = getTodayRange()
      const { data } = await getCheckins(range.start, range.end)
      return data || []
    },
  })

  const filtered = (checkins || []).filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (c.title || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.user?.name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-100">打卡记录</h1>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题、地址或人员"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300"
          >
            {viewMode === 'list' ? <Map size={14} /> : <List size={14} />}
            {viewMode === 'list' ? '地图' : '列表'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {viewMode === 'list' ? (
          <div className="divide-y divide-slate-800">
            {filtered.map((checkin) => (
              <CheckinCard key={checkin.id} checkin={checkin} isAdmin={isAdmin} />
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-600">暂无打卡记录</div>
            )}
          </div>
        ) : (
          <MapContainer center={[39.9042, 116.4074]} zoom={12} className="h-full w-full" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((c) => (
              <Marker key={c.id} position={[c.latitude, c.longitude]} icon={createCheckinIcon(c.sequence_no)}>
                <Popup>
                  <div className="min-w-[180px] space-y-1 p-1">
                    <div className="font-semibold text-slate-100">{c.title || `打卡 #${c.sequence_no}`}</div>
                    <div className="text-xs text-slate-400">{c.user?.name || '未知'}</div>
                    <div className="text-xs text-slate-500">{c.address}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(c.created_at)}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  )
}

function CheckinCard({ checkin, isAdmin }: { checkin: Checkin; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-slate-900 px-4 py-3">
      <div className="flex items-start justify-between" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">
            {checkin.sequence_no}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-200">
              {checkin.title || `打卡点 #${checkin.sequence_no}`}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{checkin.address}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">{formatDateTime(checkin.created_at)}</div>
          {isAdmin && <div className="mt-0.5 text-xs text-slate-600">{checkin.user?.name || '未知'}</div>}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-800/50 p-3 text-sm">
          {checkin.complaint_content && (
            <div>
              <span className="text-xs font-medium text-slate-500">投诉内容</span>
              <p className="mt-0.5 text-slate-300">{checkin.complaint_content}</p>
            </div>
          )}
          {checkin.test_result && (
            <div>
              <span className="text-xs font-medium text-slate-500">测试结果</span>
              <p className="mt-0.5 text-slate-300">{checkin.test_result}</p>
            </div>
          )}
          {checkin.solution_result && (
            <div>
              <span className="text-xs font-medium text-slate-500">处理结果</span>
              <p className="mt-0.5 text-slate-300">{checkin.solution_result}</p>
            </div>
          )}
          {checkin.remark && (
            <div>
              <span className="text-xs font-medium text-slate-500">备注</span>
              <p className="mt-0.5 text-slate-300">{checkin.remark}</p>
            </div>
          )}
          {checkin.photos && checkin.photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-1">
              {checkin.photos.map((p) => (
                <img key={p.id} src={p.photo_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
