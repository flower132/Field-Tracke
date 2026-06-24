import { useState, useRef, useCallback, useEffect } from 'react'
import { MapPin, Check, Trash2, Camera, Images, Loader2, AlertCircle } from 'lucide-react'
import { PhotoProvider, PhotoView } from 'react-photo-view'
import { useAuthStore } from '../store/authStore'
import { useLocationStore, getGpsStatus } from '../store/locationStore'
import { useLocationTracking } from '../hooks/useLocationTracking'
import { createCheckin, getNextSequenceNo, uploadPhoto } from '../api/supabase'
import { addPendingTask } from '../lib/indexeddb'
import { getAddressFromCoords, compressImage, formatFileSize, calculateDistance } from '../utils/helpers'
import type { GpsStatus } from '../store/locationStore'

interface PhotoItem {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

interface PositionSample {
  lat: number
  lng: number
  accuracy: number
  time: number
}

const STABILITY_CHECK_COUNT = 3
const STABILITY_THRESHOLD_METERS = 5
const GPS_QUALITY_ACCURACY_LIMIT = 50

export default function CheckinPage() {
  const { user } = useAuthStore()
  const { latitude, longitude, accuracy, speed, isTracking } = useLocationStore()
  const { forceUpload } = useLocationTracking()
  const [step, setStep] = useState<'location' | 'form' | 'success'>('location')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [gpsWarning, setGpsWarning] = useState<string | null>(null)
  const [isStable, setIsStable] = useState(false)
  const [stabilityMessage, setStabilityMessage] = useState<string | null>(null)
  const [forceCheckin, setForceCheckin] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const recentPositionsRef = useRef<PositionSample[]>([])

  const [form, setForm] = useState({
    title: '',
    complaint_content: '',
    test_result: '',
    solution_result: '',
    remark: '',
  })

  // 收集最近位置样本，用于稳定性判断
  useEffect(() => {
    if (!latitude || !longitude || !accuracy) return
    const now = Date.now()
    recentPositionsRef.current.push({ lat: latitude, lng: longitude, accuracy, time: now })
    // 只保留最近 5 个样本
    recentPositionsRef.current = recentPositionsRef.current.slice(-5)
  }, [latitude, longitude, accuracy])

  const checkStability = useCallback((): boolean => {
    const samples = recentPositionsRef.current
    if (samples.length < STABILITY_CHECK_COUNT) return false
    const recent = samples.slice(-STABILITY_CHECK_COUNT)
    for (let i = 1; i < recent.length; i++) {
      const d = calculateDistance(recent[i - 1].lat, recent[i - 1].lng, recent[i].lat, recent[i].lng)
      if (d >= STABILITY_THRESHOLD_METERS) return false
    }
    return true
  }, [])

  const resetGpsCheck = useCallback(() => {
    setGpsWarning(null)
    setStabilityMessage(null)
    setForceCheckin(false)
    setIsStable(false)
  }, [])

  const handleStart = useCallback(
    async (force = false) => {
      if (!latitude || !longitude) {
        setGpsWarning('正在获取位置，请稍候...')
        return
      }

      if (!isTracking) {
        setGpsWarning('请先开启定位上传（个人中心 → 位置上传）')
        return
      }

      const currentAccuracy = accuracy ?? Infinity

      if (currentAccuracy > GPS_QUALITY_ACCURACY_LIMIT && !force) {
        setGpsWarning(`当前定位精度不足（±${Math.round(currentAccuracy)}m），建议到开阔处再打卡`)
        setForceCheckin(true)
        return
      }

      if (!force && !checkStability()) {
        setStabilityMessage('正在校准位置稳定性，请保持静止...')
        setTimeout(() => {
          if (checkStability()) {
            setIsStable(true)
            setStabilityMessage(null)
          } else {
            setStabilityMessage('位置尚不稳定，建议静止后重试')
          }
        }, 3000)
        return
      }

      // 通过校验：立即强制上传一条轨迹点
      try {
        await forceUpload()
      } catch {
        // 上传失败不阻断打卡流程
      }

      resetGpsCheck()
      setStep('form')
    },
    [latitude, longitude, accuracy, isTracking, checkStability, forceUpload, resetGpsCheck]
  )

  const processFiles = useCallback(
    async (files: FileList | null) => {
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
      await processFiles(e.target.files)
      // 清空 input，允许重复选择同一文件（iOS Safari 兼容）
      e.target.value = ''
    },
    [processFiles]
  )

  const handleAlbumSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await processFiles(e.target.files)
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
    const gpsStatus = getGpsStatus(accuracy, speed, isTracking)

    const checkinPayload = {
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
      gps_accuracy: accuracy ?? undefined,
      gps_status: gpsStatus as GpsStatus,
    }

    // 4. 照片处理
    const processPhotos = async (checkinId: string) => {
      if (photos.length === 0) return
      setUploading(true)
      setUploadProgress({ current: 0, total: photos.length })

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'uploading' } : p)))
        setUploadProgress({ current: i, total: photos.length })

        try {
          await uploadPhoto(photo.file, checkinId)
          setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'done' } : p)))
        } catch {
          setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error' } : p)))
        }
      }

      setUploadProgress({ current: photos.length, total: photos.length })
      setUploading(false)
    }

    if (!navigator.onLine) {
      // 离线打卡：存入 IndexedDB，包含 GPS 质量与临时 ID
      const tempId = Math.random().toString(36).slice(2)
      await addPendingTask('checkins', { ...checkinPayload, tempId })

      // 离线照片一并存入 IndexedDB，等待同步
      for (const photo of photos) {
        await addPendingTask('photos', {
          checkinTempId: tempId,
          file: photo.file,
          fileName: photo.file.name,
        })
      }
    } else {
      const { data, error } = await createCheckin(checkinPayload)
      if (error || !data) {
        setSaving(false)
        alert('保存失败: ' + (error?.message || '未知错误'))
        return
      }
      await processPhotos(data.id)
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
            resetGpsCheck()
            recentPositionsRef.current = []
          }}
          className="mt-6 rounded-xl bg-primary-600 px-8 py-3 text-sm font-semibold text-white"
        >
          继续打卡
        </button>
      </div>
    )
  }

  const gpsStatus = getGpsStatus(accuracy, speed, isTracking)
  const statusConfig: Record<GpsStatus, { label: string; color: string }> = {
    acquiring: { label: '定位中', color: 'text-slate-400' },
    excellent: { label: '优秀', color: 'text-emerald-400' },
    good: { label: '良好', color: 'text-sky-400' },
    fair: { label: '一般', color: 'text-amber-400' },
    poor: { label: '较差', color: 'text-rose-400' },
  }
  const currentStatus = statusConfig[gpsStatus]

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

            {/* GPS 质量面板 */}
            <div className="mb-4 space-y-2 rounded-xl border border-slate-800/50 bg-slate-950/50 p-3 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">GPS精度</span>
                <span className="font-medium text-slate-200">
                  {accuracy !== null ? `±${Math.round(accuracy)}m` : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">定位状态</span>
                <span className={`font-medium ${currentStatus.color}`}>{currentStatus.label}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">速度</span>
                <span className="font-medium text-slate-200">{(speed || 0).toFixed(1)} km/h</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">位置上传</span>
                <span className={isTracking ? 'font-medium text-emerald-400' : 'font-medium text-slate-500'}>
                  {isTracking ? '运行中' : '已停止'}
                </span>
              </div>
            </div>

            {gpsWarning && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-left text-sm text-rose-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div className="flex-1">{gpsWarning}</div>
              </div>
            )}

            {stabilityMessage && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-left text-sm text-amber-300">
                <Loader2 size={16} className="animate-spin" />
                {stabilityMessage}
              </div>
            )}

            {isStable && (
              <div className="mb-3 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">
                位置已稳定，可以开始打卡
              </div>
            )}

            <p className="text-sm text-slate-300">
              {latitude && longitude
                ? `位置已获取: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : '正在获取位置...'}
            </p>

            <button
              onClick={() => handleStart(false)}
              disabled={!latitude || !longitude}
              className="mt-4 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              开始处理
            </button>

            {forceCheckin && (
              <button
                onClick={() => handleStart(true)}
                className="mt-3 w-full rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-sm font-semibold text-rose-400"
              >
                强制打卡（记录定位风险）
              </button>
            )}
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

                    <div className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1 py-0.5 text-[9px] text-slate-300">
                      {formatFileSize(photo.file.size)}
                    </div>
                  </div>
                ))}

                {photos.length < 9 && (
                  <div className="col-span-1 flex gap-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={compressing}
                      className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-500 active:bg-slate-800"
                    >
                      <Camera size={20} />
                      <span className="mt-1 text-[10px]">拍照</span>
                    </button>
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
              onClick={() => {
                setStep('location')
                resetGpsCheck()
              }}
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
