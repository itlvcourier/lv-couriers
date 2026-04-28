'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'

interface SignaturePadProps {
  /** Called whenever the signature changes. Receives null when cleared. */
  onChange: (dataUrl: string | null) => void
  /** Optional ARIA label for accessibility. */
  label?: string
}

/**
 * Touch- and mouse-friendly signature canvas.
 * Captures strokes as a single PNG data URI suitable for direct DB storage.
 *
 * Implementation notes:
 * - Uses devicePixelRatio for crisp lines on retina/mobile displays.
 * - Pointer Events handle both stylus, finger, and mouse with one path.
 * - We track `hasInk` so the parent can disable submit until a real signature
 *   exists (an empty canvas would otherwise produce a non-null PNG).
 */
export function SignaturePad({ onChange, label = 'Recipient signature' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)

  // Initialize canvas size + retina DPR scaling.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.2
        ctx.strokeStyle = '#0f172a' // slate-900 — readable on the white pad
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    lastPointRef.current = getPoint(e)
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pt = getPoint(e)
    if (!ctx || !pt || !lastPointRef.current) return
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPointRef.current = pt
    if (!hasInk) setHasInk(true)
  }

  const handleUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    const canvas = canvasRef.current
    if (canvas && hasInk) {
      onChange(canvas.toDataURL('image/png'))
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border border-dashed border-[var(--border-color)] bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-40 touch-none cursor-crosshair"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          onPointerCancel={handleUp}
          aria-label={label}
          role="img"
        />
        {!hasInk && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-slate-400">Sign here</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {hasInk ? 'Signature captured' : 'Use finger, stylus, or mouse'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!hasInk}
          className="h-8 gap-1 text-xs"
          type="button"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear
        </Button>
      </div>
    </div>
  )
}
