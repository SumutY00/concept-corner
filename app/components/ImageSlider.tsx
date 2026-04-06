'use client'
import { useState, useRef, useCallback } from 'react'

const VIDEO_RE = /\.(mp4|mov|webm|avi)$/i

function MediaItem({ src, alt }: { src: string; alt?: string }) {
  return VIDEO_RE.test(src)
    ? <video src={src} controls autoPlay loop playsInline style={{ width: '100%', display: 'block', maxHeight: 600 }} />
    : <img src={src} alt={alt ?? ''} style={{ width: '100%', display: 'block', maxHeight: 600, objectFit: 'cover' }} />
}

export default function ImageSlider({ images, alt }: { images: string[]; alt?: string }) {
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length])

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 40) prev()
    else if (dx < -40) next()
    touchStartX.current = null
  }

  if (!images.length) return null

  if (images.length === 1) return <MediaItem src={images[0]} alt={alt} />

  return (
    <div style={{ position: 'relative', userSelect: 'none' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Görsel */}
      <div style={{ overflow: 'hidden', background: 'var(--cc-surface-alt)' }}>
        <MediaItem src={images[current]} alt={alt} />
      </div>

      {/* Prev */}
      <button
        onClick={prev}
        aria-label="Önceki"
        style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 20, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', transition: 'background 0.2s', zIndex: 2,
        }}
      >‹</button>

      {/* Next */}
      <button
        onClick={next}
        aria-label="Sonraki"
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 20, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', transition: 'background 0.2s', zIndex: 2,
        }}
      >›</button>

      {/* Sayaç */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        background: 'rgba(0,0,0,0.5)', color: '#fff',
        borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500,
        backdropFilter: 'blur(4px)', zIndex: 2,
      }}>
        {current + 1} / {images.length}
      </div>

      {/* Dot'lar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0 4px', background: 'var(--cc-surface)' }}>
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Görsel ${i + 1}`}
            style={{
              width: i === current ? 18 : 6, height: 6,
              borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
              background: i === current ? 'var(--cc-primary)' : 'var(--cc-border)',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
