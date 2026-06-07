import { useState, useCallback } from 'react'
import { MapPin, Check, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import { createCheckin, getNextSequenceNo, uploadPhoto } from '../api/supabase'
import { getAddressFromCoords, formatFileSize } from '../utils/helpers'
import { addPendingTask } from '../lib/indexeddb'
import ImageUploader, { type PhotoItem } from '../components/ImageUploader'
import ImageGallery from '../components/ImageGallery'
import { useImageGallery } from '../hooks/useImageGallery'
function generateTempId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function CheckinPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { latitude, longitude } = useLocationStore()
  const [step, setStep] = useState<'location' | 'form' | 'success'>('location')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const gallery = useImageGallery()

  const [form, setForm] = useState({
    title: '',
    complaint_content: '',
    test_result: '',
    solution_result: '',
    remark: '',
  })

  const handleStart = async () => {
    if (!latitude || !longitude) {
      alert('正在获取位置，请稍候...')
      return
    }
    setStep('form')
  }

  const handleAddPhotos = useCallback((items: PhotoItem[]) => {
    setPhotos((prev) => [...prev, ...items])
  }, [])

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const handleReorder = useCallback((from: number, to: number) => {
    setPhotos((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const handleSubmit = async () => {
    if (!user || !latitude || !longitude || saving) return
    setSaving(true)
    const address = await getAddressFromCoords(latitude, longitude)
    const seqNo = await getNextSequenceNo(user.id)

    // 离线模式：存入 IndexedDB
    if (!navigator.onLine) {
      const tempId = generateTempId()
      await addPendingTask('checkins', {
        user_id: user.id,
        sequence_no: seqNo,
        latitude,
        longitude,
        address,
        title: form.title || `投诉处理 #${seqNo}`,
        complaint_content: form.complaint_content,
        test_result: form.test_result,
        solution_result: form.solution_result,
        remark: form.remark,
        tempId,
      })

      for (const photo of photos) {
        await addPendingTask('photos', {
          checkinTempId: tempId,
          file: photo.file,
          fileName: photo.file.name,
        })
      }

      setSaving(false)
      setStep('success')
      return
    }

    const { data, error } = await createCheckin({
      user_id: user.id,
      sequence_no: seqNo,
      latitude,
      longitude,
      address,
      title: form.title || `投诉处理 #${seqNo}`,
      complaint_content: form.complaint_content,
      test_result: form.test_result,
      solution_result: form.solution_result,
      remark: form.remark,
    })

    if (error || !data) {
      setSaving(false)
      alert('保存失败: ' + (error?.message || '未知错误'))
      return
    }

    if (photos.length > 0) {
      setUploading(true)
      setUploadProgress({ current: 0, total: photos.length })

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'uploading' } : p)))
        setUploadProgress({ current: i, total: photos.length })

        try {
          await uploadPhoto(photo.file, data.id)
          setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'done' } : p)))
        } catch {
          setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error' } : p)))
        }
      }

      setUploadProgress({ current: photos.length, total: photos.length })
      setUploading(false)
    }

    setSaving(false)
    setStep('success')
  }

  if (step === 'success') {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Check size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">打卡成功</h2>
        <p className="mt-2 text-sm text-slate-500">投诉处理记录已保存</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              setStep('location')
              setPhotos([])
              setForm({ title: '', complaint_content: '', test_result: '', solution_result: '', remark: '' })
            }}
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white"
          >
            继续打卡
          </button>
          <button
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300"
          >
            查看记录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-20 pt-4">
      <h1 className="text-xl font-bold text-slate-100">投诉处理打卡</h1>
      <p className="mt-1 text-sm text-slate-500">记录现场位置与处理信息</p>

      {step === 'location' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary-500/10 text-primary-400">
              <MapPin size={36} />
            </div>
            <p className="text-sm text-slate-300">
              {latitude && longitude
                ? `位置已获取: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : '正在获取位置...'}
            </p>
            <button
              onClick={handleStart}
              disabled={!latitude || !longitude}
              className="mt-6 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              开始处理
            </button>
          </div>
        </div>
      )}

      {step === 'form' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
            <label className="mb-1 block text-sm font-medium text-slate-400">投诉标题</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="请输入投诉标题"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
            <label className="mb-1 block text-sm font-medium text-slate-400">投诉内容</label>
            <textarea
              value={form.complaint_content}
              onChange={(e) => setForm((f) => ({ ...f, complaint_content: e.target.value }))}
              placeholder="描述投诉内容"
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
            <label className="mb-1 block text-sm font-medium text-slate-400">测试结果</label>
            <textarea
              value={form.test_result}
              onChange={(e) => setForm((f) => ({ ...f, test_result: e.target.value }))}
              placeholder="填写测试结果"
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
            <label className="mb-1 block text-sm font-medium text-slate-400">处理结果</label>
            <textarea
              value={form.solution_result}
              onChange={(e) => setForm((f) => ({ ...f, solution_result: e.target.value }))}
              placeholder="填写处理结果"
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
            <label className="mb-1 block text-sm font-medium text-slate-400">备注</label>
            <textarea
              value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              placeholder="其他备注信息"
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          {/* Photos */}
          <ImageUploader
            photos={photos}
            onAdd={handleAddPhotos}
            onRemove={handleRemovePhoto}
            onReorder={handleReorder}
            maxCount={9}
          />

          {/* 预览大图入口 */}
          {photos.length > 0 && (
            <button
              onClick={() =>
                gallery.openGallery(
                  0,
                  photos.map((p) => ({ src: p.preview }))
                )
              }
              className="w-full rounded-xl border border-slate-700 py-2 text-xs text-slate-400"
            >
              查看大图 ({photos.length}张)
            </button>
          )}

          {/* 上传进度 */}
          {uploading && uploadProgress.total > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>正在上传照片...</span>
                <span>
                  {uploadProgress.current}/{uploadProgress.total}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{
                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('location')}
              className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300"
            >
              返回
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploading || saving}
              className="flex-1 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? '保存中...' : uploading ? '上传中...' : '保存打卡'}
            </button>
          </div>
        </div>
      )}

      <ImageGallery
        images={photos.map((p) => ({ src: p.preview }))}
        initialIndex={gallery.currentIndex}
        isOpen={gallery.isOpen}
        onClose={gallery.closeGallery}
        onPrev={gallery.prev}
        onNext={gallery.next}
      />
    </div>
  )
}
