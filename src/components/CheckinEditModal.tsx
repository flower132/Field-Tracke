import { useState } from 'react'
import { X, Edit3, Clock, User } from 'lucide-react'
import { updateCheckin } from '../api/supabase'
import { useAuthStore } from '../store/authStore'
import type { Checkin } from '../types'
import { formatDateTime } from '../utils/helpers'

interface Props {
  checkin: Checkin
  isOpen: boolean
  onClose: () => void
  onSaved: (updated: Checkin) => void
}

export default function CheckinEditModal({ checkin, isOpen, onClose, onSaved }: Props) {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    complaint_content: checkin.complaint_content || '',
    test_result: checkin.test_result || '',
    solution_result: checkin.solution_result || '',
    remark: checkin.remark || '',
  })
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    if (!user || saving) return
    setSaving(true)
    const { data, error } = await updateCheckin(checkin.id, form, user.id)
    setSaving(false)
    if (error || !data) {
      alert('保存失败: ' + (error?.message || '未知错误'))
      return
    }
    onSaved(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-slate-900 p-4 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-primary-400" />
            <span className="font-semibold text-slate-100">编辑打卡</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-400">
              #{checkin.sequence_no}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-800 p-1.5 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">投诉内容</label>
            <textarea
              value={form.complaint_content}
              onChange={(e) => setForm((f) => ({ ...f, complaint_content: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">测试结果</label>
            <textarea
              value={form.test_result}
              onChange={(e) => setForm((f) => ({ ...f, test_result: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">处理结果</label>
            <textarea
              value={form.solution_result}
              onChange={(e) => setForm((f) => ({ ...f, solution_result: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">备注</label>
            <textarea
              value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div className="rounded-lg bg-slate-800/50 p-3">
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <Edit3 size={10} />
              {checkin.edit_count && checkin.edit_count > 0
                ? `已修改 ${checkin.edit_count} 次`
                : '尚未修改'}
            </div>
            {checkin.last_edited_at && (
              <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-600">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatDateTime(checkin.last_edited_at)}
                </span>
                {checkin.last_edited_by_name && (
                  <span className="flex items-center gap-1">
                    <User size={10} />
                    {checkin.last_edited_by_name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  )
}
