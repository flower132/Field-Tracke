import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  alt?: string
  className?: string
  placeholderClassName?: string
}

export default function LazyImage({ src, alt = '', className = '', placeholderClassName = '' }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!inView) {
    return (
      <div
        ref={imgRef}
        className={`bg-slate-800 ${placeholderClassName || className}`}
      />
    )
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      onLoad={() => setLoaded(true)}
      loading="lazy"
    />
  )
}
