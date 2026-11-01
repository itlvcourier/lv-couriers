import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()
    const deliveryId = formData.get('deliveryId') as string
    const auth = await requireDeliveryParty(request, deliveryId)
    if (isAuthError(auth)) return auth

    const imageData = formData.get('image') as string
    const photoType = formData.get('photoType') as string // 'pickup' | 'delivery' | 'signature'

    if (!imageData || !deliveryId || !photoType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!/^data:image\/(jpeg|png|webp);base64,/i.test(imageData) || !['pickup', 'delivery', 'signature'].includes(photoType)) {
      return NextResponse.json({ error: 'Invalid proof format' }, { status: 400 })
    }
    if (imageData.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: 'Proof image is too large' }, { status: 413 })
    }

    // Convert base64 to blob
    const base64Data = imageData.replace(/^data:image\/(jpeg|png|webp);base64,/i, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Determine content type
    const contentType = imageData.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg'
    const extension = contentType.split('/')[1] || 'jpg'
    
    // Create unique filename
    const timestamp = Date.now()
    const filename = `proof/${deliveryId}/${photoType}_${timestamp}.${extension}`

    // Upload to Vercel Blob (private storage)
    const blob = await put(filename, buffer, {
      access: 'private',
      contentType,
    })

    // Return the pathname for later retrieval
    return NextResponse.json({ 
      pathname: blob.pathname,
      url: blob.url, // Note: This URL won't work directly for private blobs
      photoType,
      deliveryId,
    })
  } catch (error) {
    console.error('Upload proof photo error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
