import { useRef, useCallback, useState } from 'react'
import { Camera, Images, Trash2, Loader2, GripVertical } from 'lucide-react'
import { compressImage, formatFileSize } from '../utils/helpers'

export interface PhotoItem {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

interface Props {
  photos: PhotoItem[]
  onAdd: (items: PhotoItem[]) => void
  onRemove: (id: string) => void
  onReorder: (from: number, to: number) => void
  maxCount?: number
  compressing?: boolean
}

export default function ImageUploader({
  photos,
  onAdd,
  onRemove,
  onReorder,
  maxCount = 9,
  compressing = false,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const processFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      if (photos.length + files.length > maxCount) {
        alert(`最多上传${maxCount}张照片`)
        return
      }

      const newPhotos: PhotoItem[] = []
      for (const file of Array.from(files)) {
        let finalFile = file
        if (file.size > 3 * 1024 * 1024) {
          try {
            const { blob } = await compressImage(file, { maxSizeMB: 3, quality: 0.85 })
            finalFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          } catch {
            // 压缩失败，使用原文件
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
      onAdd(newPhotos)
    },
    [photos.length, maxCount, onAdd]
  )

  const handleCameraSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await processFiles(e.target.files)
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

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    onReorder(dragIndex, index)
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
  }

  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-400">
          现场照片 ({photos.length}/{maxCount})
        </label>
        {compressing && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Loader2 size={12} className="animate-spin" />
            压缩中...
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative aspect-square overflow-hidden rounded-xl ${
              photo.status === 'error' ? 'ring-2 ring-rose-500' : ''
            } ${dragIndex === index ? 'opacity-50' : ''}`}
          >
            <img
              src={photo.preview}
              alt=""
              className="h-full w-full object-cover"
            />

            {/* 拖拽手柄 */}
            <div className="absolute left-1 top-1 cursor-grab rounded bg-black/40 p-0.5 text-white/70 active:cursor-grabbing">
              <GripVertical size={12} />
            </div>

            {/* 状态遮罩 */}
            {photo.status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                <Loader2 size={20} className="animate-spin text-white" />
              </div>
            )}
            {photo.status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                <span className="text-xs text-rose-400">失败</span>
              </div>
            )}

            {/* 删除按钮 */}
            {photo.status === 'pending' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(photo.id)
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
        {photos.length < maxCount && (
          <div className="col-span-1 flex gap-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={compressing}
              className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-500 active:bg-slate-800"
            >
              <Camera size={20} />
              <span className="mt-1 text-[10px]">拍照</span>
            </button>
            {photos.length < maxCount - 1 && (
              <button
                onClick={() => albumInputRef.current?.click()}
                disabled={compressing}
                className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-500 active:bg-slate-800"
              >
                <Images size={20} />
                <span className="mt-1 text-[10px]">相册</span>
              </button>
            )}
          </div>
        )}
      </div>

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
    </div>
  )
}
