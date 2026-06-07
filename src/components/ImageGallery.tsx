import { useRef, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'

interface Props {
  images: { src: string; alt?: string }[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export default function ImageGallery({
  images,
  initialIndex,
  isOpen,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart) return
      const dx = e.changedTouches[0].clientX - touchStart.x
      const dy = e.changedTouches[0].clientY - touchStart.y
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx > 0) onPrev()
        else onNext()
      }
      setTouchStart(null)
    },
    [touchStart, onPrev, onNext]
  )

  const handleDownload = useCallback(() => {
    const src = images[initialIndex]?.src
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = src.split('/').pop() || 'image.jpg'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [images, initialIndex])

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[3000] flex flex-col bg-black/95 backdrop-blur"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-slate-400">
          {initialIndex + 1} / {images.length}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={handleDownload} className="text-slate-400">
            <Download size={20} />
          </button>
          <button onClick={onClose} className="text-slate-400">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* 图片区域 */}
      <div className="relative flex flex-1 items-center justify-center">
        <button
          onClick={onPrev}
          className="absolute left-2 z-10 rounded-full bg-black/40 p-2 text-white"
        >
          <ChevronLeft size={28} />
        </button>

        <img
          src={images[initialIndex]?.src}
          alt={images[initialIndex]?.alt || ''}
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />

        <button
          onClick={onNext}
          className="absolute right-2 z-10 rounded-full bg-black/40 p-2 text-white"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  )
}
