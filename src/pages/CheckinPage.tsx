import { useState, useRef, useCallback } from 'react'
import { MapPin, Check, Trash2, Camera, Images, Loader2, AlertCircle } from 'lucide-react'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import { useAuthStore } from '../store/authStore'
import { useLocationStore } from '../store/locationStore'
import { createCheckin, getNextSequenceNo, uploadPhoto } from '../api/supabase'
import { getAddressFromCoords, compressImage, formatFileSize } from '../utils/helpers'

interface PhotoItem {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

export default function CheckinPage() {
  const { user } = useAuthStore()
  const { latitude, longitude } = useLocationStore()
  const [step, setStep] = useState<'location' | 'form' | 'success'>('location')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)

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

  const processFiles = useCallback(
    async (files: FileList | null, _source: 'camera' | 'album') => {
      if (!files) return
      if (photos.length + files.length > 9) {
        alert('最多上传9张照片')
        return
      }
      setCompressing(true)

      const newPhotos: PhotoItem[] = []
      for (const file of Array.from(files)) {
        let finalFile = file

        // 3. 图片压缩：大于3MB自动压缩
        if (file.size > 3 * 1024 * 1024) {
          try {
            const { blob } = await compressImage(file, { maxSizeMB: 3, quality: 0.85 })
            finalFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          } catch {
            // 压缩失败，使用原文件继续
          }
        }

        const preview = URL.createObjectURL(finalFile)
        newPhotos.push({
          id: Math.random().toString(36).slice(2),
          file: finalFile,
          preview,
          status: 'pending',
        })
      }

      setPhotos((prev) => [...prev, ...newPhotos])
      setCompressing(false)
    },
    [photos.length]
  )

  const handleCameraSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await processFiles(e.target.files, 'camera')
      // 清空 input，允许重复选择同一文件（iOS Safari 兼容）
      e.target.value = ''
    },
    [processFiles]
  )

  const handleAlbumSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await processFiles(e.target.files, 'album')
      e.target.value = ''
    },
    [processFiles]
  )

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((p) => p.id !== id)
    })
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

    if (error || !data) {
      setSaving(false)
      alert('保存失败: ' + (error?.message || '未知错误'))
      return
    }

    // 4. 上传进度显示
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
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-400">
                现场照片 ({photos.length}/9)
              </label>
              {compressing && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 size={12} className="animate-spin" />
                  压缩中...
                </span>
              )}
            </div>

            {/* 6. 上传前预览 + 5. 删除已选图片 */}
            <PhotoProvider>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`relative aspect-square overflow-hidden rounded-xl ${
                      photo.status === 'error' ? 'ring-2 ring-rose-500' : ''
                    }`}
                  >
                    <PhotoView src={photo.preview}>
                      <img
                        src={photo.preview}
                        alt=""
                        className="h-full w-full cursor-pointer object-cover"
                      />
                    </PhotoView>

                    {/* 状态遮罩 */}
                    {photo.status === 'uploading' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                        <Loader2 size={20} className="animate-spin text-white" />
                      </div>
                    )}
                    {photo.status === 'error' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                        <AlertCircle size={20} className="text-rose-400" />
                      </div>
                    )}

                    {/* 删除按钮 */}
                    {photo.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removePhoto(photo.id)
                        }}
                        className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-slate-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    {/* 文件大小 */}
                    <div className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1 py-0.5 text-[9px] text-slate-300">
                      {formatFileSize(photo.file.size)}
                    </div>
                  </div>
                ))}

                {/* 添加照片按钮组 */}
                {photos.length < 9 && (
                  <div className="col-span-1 flex gap-2">
                    {/* 拍照按钮 */}
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={compressing}
                      className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-500 active:bg-slate-800"
                    >
                      <Camera size={20} />
                      <span className="mt-1 text-[10px]">拍照</span>
                    </button>
                    {/* 相册按钮 */}
                    <button
                      onClick={() => albumInputRef.current?.click()}
                      disabled={compressing}
                      className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-500 active:bg-slate-800"
                    >
                      <Images size={20} />
                      <span className="mt-1 text-[10px]">相册</span>
                    </button>
                  </div>
                )}
              </div>
            </PhotoProvider>

            {/* 隐藏的 input 元素 */}
            {/* 7/8. iPhone Safari / Android Chrome 兼容 */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleCameraSelect}
              className="hidden"
            />
            <input
              ref={albumInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAlbumSelect}
              className="hidden"
            />

            {/* 4. 上传进度显示 */}
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
              disabled={uploading || saving || compressing}
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
