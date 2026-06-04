import { useState, useRef, useCallback } from 'react'
import { MapPin, Check, ImagePlus, Trash2 } from 'lucide-react'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import { createCheckin, getNextSequenceNo, uploadPhoto } from '../api/supabase'
import { getAddressFromCoords } from '../utils/helpers'
export default function CheckinPage() {
  const { user } = useAuthStore()
  const { latitude, longitude } = useLocationStore()
  const [step, setStep] = useState<'location' | 'form' | 'success'>('location')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handlePhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return
      if (photos.length + files.length > 9) {
        alert('最多上传9张照片')
        return
      }
      setUploading(true)
      const newPhotos: string[] = []
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file)
        newPhotos.push(url)
      }
      setPhotos((prev) => [...prev, ...newPhotos])
      setUploading(false)
    },
    [photos.length]
  )

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!user || !latitude || !longitude || saving) return
    setSaving(true)
    const address = await getAddressFromCoords(latitude, longitude)
    const seqNo = await getNextSequenceNo(user.id)

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

    setSaving(false)

    if (error || !data) {
      alert('保存失败: ' + (error?.message || '未知错误'))
      return
    }

    // Upload photos
    for (const photoUrl of photos) {
      try {
        const response = await fetch(photoUrl)
        const blob = await response.blob()
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        await uploadPhoto(file, data.id)
      } catch {
        // ignore
      }
    }

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
        <button
          onClick={() => {
            setStep('location')
            setPhotos([])
            setForm({ title: '', complaint_content: '', test_result: '', solution_result: '', remark: '' })
          }}
          className="mt-6 rounded-xl bg-primary-600 px-8 py-3 text-sm font-semibold text-white"
        >
          继续打卡
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-20 pt-4">
      <h1 className="text-xl font-bold text-slate-100">投诉处理打卡</h1>
      <p className="mt-1 text-sm text-slate-500">记录现场位置与处理信息</p>

      {step === 'location' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-slate-900 p-6 text-center">
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">投诉标题</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="请输入投诉标题"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">投诉内容</label>
            <textarea
              value={form.complaint_content}
              onChange={(e) => setForm((f) => ({ ...f, complaint_content: e.target.value }))}
              placeholder="描述投诉内容"
              rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">测试结果</label>
            <textarea
              value={form.test_result}
              onChange={(e) => setForm((f) => ({ ...f, test_result: e.target.value }))}
              placeholder="填写测试结果"
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">处理结果</label>
            <textarea
              value={form.solution_result}
              onChange={(e) => setForm((f) => ({ ...f, solution_result: e.target.value }))}
              placeholder="填写处理结果"
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-primary-500"
            />
          </div>

          <div>
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
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">现场照片 ({photos.length}/9)</label>
            <PhotoProvider
              toolbarRender={({ images, index }) => {
                const src = images[index]?.src
                return (
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-sm opacity-80">
                      {index + 1} / {images.length}
                    </span>
                    {src && (
                      <button
                        onClick={() => {
                          const a = document.createElement('a')
                          a.href = src
                          a.download = src.split('/').pop() || 'image.jpg'
                          a.target = '_blank'
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                        }}
                        className="text-sm opacity-80 hover:opacity-100"
                        title="下载图片"
                      >
                        下载
                      </button>
                    )}
                  </div>
                )
              }}
            >
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden rounded-xl">
                    <PhotoView src={url}>
                      <img src={url} alt="" className="h-full w-full cursor-pointer object-cover" />
                    </PhotoView>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removePhoto(idx)
                      }}
                      className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-slate-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < 9 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-500"
                  >
                    <ImagePlus size={24} />
                    <span className="mt-1 text-xs">添加照片</span>
                  </button>
                )}
              </div>
            </PhotoProvider>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

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
    </div>
  )
}
