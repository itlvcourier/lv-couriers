'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, RotateCcw, Check, SwitchCamera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { isNativeApp } from '@/lib/native'
import { takeNativePhoto } from '@/lib/native/camera'
import { normalizeImageDataUrl } from '@/lib/image'

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void
  onCancel?: () => void
  label?: string
  required?: boolean
  existingImage?: string | null
}

export function CameraCapture({ 
  onCapture, 
  onCancel,
  label = 'Take Photo',
  required = false,
  existingImage = null 
}: CameraCaptureProps) {
  const [preview, setPreview] = useState<string | null>(existingImage)
  const [isCapturing, setIsCapturing] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Start camera stream
  const startCamera = useCallback(async () => {
    // In the native app, use the OS camera instead of the web video stream.
    if (isNativeApp()) {
      try {
        const dataUrl = await takeNativePhoto('camera', { quality: 80 })
        if (dataUrl) {
          setPreview(await normalizeImageDataUrl(dataUrl))
        }
      } catch (err) {
        console.error('[v0] native camera error:', err)
        toast.error('Could not access camera.')
      }
      return
    }

    try {
      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })
      
      setStream(mediaStream)
      setIsCapturing(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      }
    } catch (err) {
      console.error('Camera access error:', err)
      toast.error('Could not access camera. Please use file upload instead.')
      // Fallback to file input
      fileInputRef.current?.click()
    }
  }, [facingMode, stream])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCapturing(false)
  }, [stream])

  // Capture photo from video
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Convert to data URL, then normalize for consistent size across devices
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setPreview(await normalizeImageDataUrl(dataUrl))
    
    // Stop camera
    stopCamera()
  }, [stopCamera])

  // Switch camera (front/back)
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
    // Restart camera with new facing mode
    if (isCapturing) {
      stopCamera()
      setTimeout(() => startCamera(), 100)
    }
  }, [isCapturing, startCamera, stopCamera])

  // Handle file input (fallback)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB')
      return
    }

    const reader = new FileReader()
    reader.onloadend = async () => {
      setPreview(await normalizeImageDataUrl(reader.result as string))
    }
    reader.readAsDataURL(file)
  }

  // Confirm the captured photo
  const handleConfirm = () => {
    if (preview) {
      onCapture(preview)
      toast.success('Photo captured')
    }
  }

  // Clear and retake
  const handleRetake = () => {
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Cancel capture
  const handleCancel = () => {
    stopCamera()
    setPreview(null)
    onCancel?.()
  }

  // Open gallery — native picker in the app, hidden file input on web.
  const handleGallery = useCallback(async () => {
    if (isNativeApp()) {
      try {
        const dataUrl = await takeNativePhoto('gallery', { quality: 80 })
        if (dataUrl) setPreview(await normalizeImageDataUrl(dataUrl))
      } catch (err) {
        console.error('[v0] native gallery error:', err)
        toast.error('Could not open gallery.')
      }
      return
    }
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="space-y-3">
      {/* Hidden file input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera/Preview view */}
      {isCapturing ? (
        // Live camera view
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover"
          />
          
          {/* Camera controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={stopCamera}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-white"
              >
                <X className="w-6 h-6" />
              </Button>
              
              <Button
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white hover:bg-gray-100"
              >
                <div className="w-12 h-12 rounded-full border-4 border-gray-800" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={switchCamera}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-white"
              >
                <SwitchCamera className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>
      ) : preview ? (
        // Preview captured photo — object-contain shows the whole photo at its
        // true aspect ratio (no cropping/stretching) consistently on any device.
        <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center">
          <img
            src={preview}
            alt="Captured photo"
            className="w-full h-64 object-contain"
          />
          
          {/* Photo confirmed badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-green)]/90 text-white text-xs font-medium">
            <Check className="w-3 h-3" />
            Photo captured
          </div>
          
          {/* Retake button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRetake}
            className="absolute bottom-3 right-3 gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Retake
          </Button>
        </div>
      ) : (
        // Initial state - buttons to capture
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={startCamera}
            className="w-full h-32 rounded-xl border-dashed border-[var(--border-color)] flex flex-col items-center justify-center gap-2"
          >
            <Camera className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {label} {required && '*'}
            </span>
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleGallery}
            className="w-full h-10 text-sm text-muted-foreground"
          >
            <Upload className="w-4 h-4 mr-2" />
            Or upload from gallery
          </Button>
        </div>
      )}

      {/* Confirm/Cancel buttons when preview exists and not yet confirmed */}
      {preview && !existingImage && (
        <div className="flex gap-3">
          {onCancel && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Use This Photo
          </Button>
        </div>
      )}
    </div>
  )
}
