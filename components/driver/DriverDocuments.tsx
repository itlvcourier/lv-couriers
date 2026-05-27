'use client'

import { useState, useRef } from 'react'
import { useApp } from '@/lib/context'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Upload, 
  Check, 
  AlertCircle, 
  Loader2,
  Eye,
  Trash2,
  Car,
  Shield,
  FileCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface DocumentStatus {
  document_type: string
  file_path: string | null
  file_name: string | null
  uploaded_at: string | null
  status: 'missing' | 'uploaded' | 'expired' | 'pending_review'
  expiry_date?: string | null
}

const DOCUMENT_TYPES = [
  { 
    id: 'drivers_license', 
    label: "Driver's License", 
    description: 'Valid government-issued driver\'s license',
    icon: Car,
    required: true,
  },
  { 
    id: 'vehicle_insurance', 
    label: 'Vehicle Insurance', 
    description: 'Current vehicle insurance certificate',
    icon: Shield,
    required: true,
  },
  { 
    id: 'vehicle_registration', 
    label: 'Vehicle Registration', 
    description: 'Current vehicle registration document',
    icon: FileCheck,
    required: true,
  },
  { 
    id: 'background_check', 
    label: 'Background Check', 
    description: 'Background check clearance (if applicable)',
    icon: FileText,
    required: false,
  },
]

export function DriverDocuments() {
  const { currentUser } = useApp()
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Fetch driver documents from database
  const fetchDocuments = async () => {
    if (!currentUser?.id) return []
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('driver_documents')
      .select('*')
      .eq('driver_id', currentUser.id)
    
    if (error) {
      console.error('Error fetching documents:', error)
      return []
    }
    return data || []
  }

  const { data: documents = [], mutate } = useSWR(
    currentUser?.id ? `driver-documents-${currentUser.id}` : null,
    fetchDocuments
  )

  const getDocumentStatus = (docType: string): DocumentStatus => {
    const doc = documents.find((d: { document_type: string }) => d.document_type === docType)
    
    if (!doc) {
      return { document_type: docType, file_path: null, file_name: null, uploaded_at: null, status: 'missing' }
    }
    
    // Check if expired
    if (doc.expiry_date && new Date(doc.expiry_date) < new Date()) {
      return { ...doc, status: 'expired' }
    }
    
    return { ...doc, status: 'uploaded' }
  }

  const handleFileSelect = async (docType: string, file: File) => {
    if (!currentUser?.id) {
      toast.error('Not logged in')
      return
    }

    setUploading(docType)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', docType)
      formData.append('driverId', currentUser.id)

      const response = await fetch('/api/driver/upload-document', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      toast.success('Document uploaded successfully')
      mutate() // Refresh documents list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload document')
    } finally {
      setUploading(null)
    }
  }

  const handleViewDocument = (filePath: string) => {
    // Open document in new tab via the serve API
    window.open(`/api/driver/document?pathname=${encodeURIComponent(filePath)}`, '_blank')
  }

  const uploadedCount = DOCUMENT_TYPES.filter(dt => getDocumentStatus(dt.id).status === 'uploaded').length
  const requiredCount = DOCUMENT_TYPES.filter(dt => dt.required).length
  const requiredUploaded = DOCUMENT_TYPES.filter(dt => dt.required && getDocumentStatus(dt.id).status === 'uploaded').length

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documents
          </CardTitle>
          <CardDescription>
            Upload and manage your required documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {requiredUploaded} of {requiredCount} required documents uploaded
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {uploadedCount} total documents on file
              </p>
            </div>
            {requiredUploaded === requiredCount ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                <Check className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                Incomplete
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <div className="space-y-3">
        {DOCUMENT_TYPES.map(docType => {
          const status = getDocumentStatus(docType.id)
          const Icon = docType.icon
          const isUploading = uploading === docType.id

          return (
            <Card 
              key={docType.id} 
              className="bg-[var(--bg-card)] border-[var(--border-color)]"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    status.status === 'uploaded' 
                      ? 'bg-green-500/10 text-green-500' 
                      : status.status === 'expired'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{docType.label}</h3>
                      {docType.required && (
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {docType.description}
                    </p>
                    
                    {status.status === 'uploaded' && status.uploaded_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Uploaded: {new Date(status.uploaded_at).toLocaleDateString()}
                        {status.file_name && ` • ${status.file_name}`}
                      </p>
                    )}
                    
                    {status.status === 'expired' && (
                      <p className="text-xs text-red-500 mt-2">
                        Document has expired. Please upload a new copy.
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {status.status === 'uploaded' && status.file_path && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDocument(status.file_path!)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant={status.status === 'uploaded' ? 'outline' : 'default'}
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[docType.id]?.click()}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Uploading...
                        </>
                      ) : status.status === 'uploaded' ? (
                        <>
                          <Upload className="w-4 h-4 mr-1" />
                          Replace
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-1" />
                          Upload
                        </>
                      )}
                    </Button>
                    
                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[docType.id] = el }}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleFileSelect(docType.id, file)
                          e.target.value = '' // Reset input
                        }
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Help Text */}
      <Card className="bg-muted/30 border-border/50">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-2">Accepted File Formats</h4>
          <p className="text-xs text-muted-foreground">
            PDF, JPEG, PNG, or WebP files up to 10MB. All documents are stored securely and only accessible by you and administrators.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
