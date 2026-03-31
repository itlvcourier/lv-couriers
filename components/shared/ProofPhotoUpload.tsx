'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProofPhotoUploadProps {
  onPhotoSelected: (url: string) => void
  onCancel: () => void
}

export function ProofPhotoUpload({ onPhotoSelected, onCancel }: ProofPhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // TODO: Replace with Capacitor Camera plugin
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleConfirm = () => {
    if (preview) {
      onPhotoSelected(preview)
    }
  }

  const handleClear = () => {
    setPreview(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-[#1f2535] rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-orange-500/50 hover:bg-[#1a1e2a] transition-all duration-200"
        >
          <div className="w-16 h-16 rounded-full bg-[#1a1e2a] flex items-center justify-center">
            <Camera className="w-8 h-8 text-[#6b7280]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#e8eaf0]">Take or upload photo</p>
            <p className="text-xs text-[#6b7280]">Tap to capture proof of delivery</p>
          </div>
        </button>
      ) : (
        <div className="relative">
          <img
            src={preview}
            alt="Proof of delivery preview"
            className="w-full h-48 object-cover rounded-2xl"
          />
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex gap-3">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1 h-12 rounded-xl border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!preview}
          className="flex-1 h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold disabled:opacity-50"
        >
          Complete Delivery
        </Button>
      </div>
    </div>
  )
}
