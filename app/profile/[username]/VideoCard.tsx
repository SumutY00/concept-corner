'use client'

export default function VideoCard({ src, className }: { src: string; className?: string }) {
  return (
    <video
      src={src}
      muted
      loop
      playsInline
      className={className}
      onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
      onMouseLeave={e => {
        const v = e.currentTarget as HTMLVideoElement
        v.pause()
        v.currentTime = 0
      }}
    />
  )
}
