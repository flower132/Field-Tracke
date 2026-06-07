import { useState, useCallback, useEffect } from 'react'

interface GalleryImage {
  src: string
  alt?: string
}

export function useImageGallery() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [images, setImages] = useState<GalleryImage[]>([])

  const openGallery = useCallback((index: number, imgs: GalleryImage[]) => {
    setImages(imgs)
    setCurrentIndex(index)
    setIsOpen(true)
  }, [])

  const closeGallery = useCallback(() => {
    setIsOpen(false)
  }, [])

  const next = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const prev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') closeGallery()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, next, prev, closeGallery])

  const currentImage = images[currentIndex]

  return {
    isOpen,
    currentIndex,
    images,
    currentImage,
    openGallery,
    closeGallery,
    next,
    prev,
  }
}
