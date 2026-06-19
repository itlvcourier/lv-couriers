'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// Web-first QR scanner hook.
//
// Prefers the native BarcodeDetector API (fast, no JS decoding) and falls back
// to @zxing/browser where it's unavailable (Safari/Firefox). Exposes a video
// ref to attach to a <video> element, plus start/stop controls.
// ============================================================================

type DetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts?: { formats?: string[] }): DetectorLike
      getSupportedFormats?: () => Promise<string[]>
    }
  }
}

export interface UseQrScannerOptions {
  onDecode: (text: string) => void
  /** Pause detection (e.g. while a confirmation card is showing). */
  paused?: boolean
}

export interface QrScannerState {
  videoRef: React.RefObject<HTMLVideoElement | null>
  active: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useQrScanner({ onDecode, paused }: UseQrScannerOptions): QrScannerState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null)
  const pausedRef = useRef<boolean>(!!paused)
  const lastDecodeRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    pausedRef.current = !!paused
  }, [paused])

  const emit = useCallback(
    (text: string) => {
      if (pausedRef.current) return
      const now = Date.now()
      // Debounce identical reads within 1.5s so one parcel = one event.
      if (text === lastDecodeRef.current.text && now - lastDecodeRef.current.at < 1500) {
        return
      }
      lastDecodeRef.current = { text, at: now }
      onDecode(text)
    },
    [onDecode],
  )

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop()
      } catch {
        /* noop */
      }
      zxingControlsRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setActive(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported on this device.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
    } catch {
      setError('Camera permission denied. Use "Pick from list" to continue.')
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (!video) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    try {
      await video.play()
    } catch {
      /* autoplay can reject; detection still works once frames flow */
    }
    setActive(true)

    // --- Native BarcodeDetector path ---
    if (typeof window !== 'undefined' && window.BarcodeDetector) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const tick = async () => {
          if (!streamRef.current || !ctx || !videoRef.current) return
          const v = videoRef.current
          if (v.readyState >= 2 && v.videoWidth > 0) {
            canvas.width = v.videoWidth
            canvas.height = v.videoHeight
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
            try {
              const codes = await detector.detect(canvas)
              if (codes.length > 0 && codes[0]?.rawValue) {
                emit(codes[0].rawValue)
              }
            } catch {
              /* transient detect error — keep scanning */
            }
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return
      } catch {
        // Fall through to ZXing.
      }
    }

    // --- ZXing fallback path ---
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromVideoElement(video, (result) => {
        if (result) emit(result.getText())
      })
      zxingControlsRef.current = controls
    } catch {
      setError('Unable to start the QR reader. Use "Pick from list" instead.')
    }
  }, [emit])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { videoRef, active, error, start, stop }
}
