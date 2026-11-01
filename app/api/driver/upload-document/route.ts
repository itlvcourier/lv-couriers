import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string
    const driverId = formData.get('driverId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!documentType || !driverId) {
      return NextResponse.json({ error: 'Missing document type or driver ID' }, { status: 400 })
    }
    if (auth.profile.role !== 'admin') {
      const { data: driver } = await createAdminClient().from('drivers').select('id').eq('id', driverId).eq('user_id', auth.user.id).maybeSingle()
      if (!driver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, JPEG, PNG, WebP' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 })
    }

    // Create unique filename
    const ext = file.name.split('.').pop()
    const filename = `drivers/${driverId}/${documentType}-${Date.now()}.${ext}`

    // Upload to Vercel Blob (private)
    const blob = await put(filename, file, {
      access: 'private',
    })

    // Store the document reference in database
    const { error: dbError } = await supabase
      .from('driver_documents')
      .upsert({
        driver_id: driverId,
        document_type: documentType,
        file_path: blob.pathname,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        uploaded_at: new Date().toISOString(),
      }, {
        onConflict: 'driver_id,document_type',
      })

    if (dbError) {
      console.error('Database error:', dbError)
      // Continue even if DB fails - file is uploaded
    }

    return NextResponse.json({ 
      success: true,
      pathname: blob.pathname,
      documentType,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
