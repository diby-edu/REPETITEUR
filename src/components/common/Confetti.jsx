'use client'
import { useEffect, useRef } from 'react'

const COLORS = ['#E87722', '#2D6A4F', '#F4A61D', '#3b82f6', '#a855f7', '#ef4444']

export default function Confetti({ duration = 3200, onDone }) {
  const canvasRef = useRef(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDoneRef.current?.()
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const particles = Array.from({ length: 160 }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.5,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speedY: 2 + Math.random() * 3,
      speedX: (Math.random() - 0.5) * 2.5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }))

    let start = null
    let rafId

    const draw = (timestamp) => {
      if (!start) start = timestamp
      const elapsed = timestamp - start
      ctx.clearRect(0, 0, width, height)

      const fadeStart = duration - 600
      const alpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / 600) : 1

      particles.forEach(p => {
        p.x += p.speedX
        p.y += p.speedY
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.globalAlpha = alpha
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      })

      if (elapsed < duration) {
        rafId = requestAnimationFrame(draw)
      } else {
        onDoneRef.current?.()
      }
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [duration])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[9999]" aria-hidden="true" />
}
