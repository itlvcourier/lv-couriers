'use client'

import { useEffect, useState } from 'react'
import { buildLabelsHtml, type LabelData, type LabelSize } from '@/lib/labels'

const SAMPLE: LabelData = {
  scanToken: 'LV-7Q2X',
  orderShortId: 'A1B2C3D4',
  recipientName: 'Jordan Whitfield',
  recipientPhone: '+1 403 555 0142',
  address: '1842 17 Avenue SW, Calgary, AB',
  postalCode: 'T2T 0E9',
  buzzCode: '#204',
  pickupAddress: 'Glamorgan Pharmacy, 5500 Glenmore Tr SW',
  zoneName: 'Southwest',
  zoneColor: '#2563eb',
  driverInitials: 'MR',
  driverName: 'Marcus Reed',
  businessName: 'Glamorgan Pharmacy',
  trackingCode: 'TRK-558210',
  isRush: true,
  distanceKm: 8.4,
  pieces: 3,
  requireSignature: true,
  requirePhoto: true,
  createdAt: new Date().toISOString(),
}

export default function LabelPreview() {
  const [html, setHtml] = useState('')
  const [size, setSize] = useState<LabelSize>('halfA4')
  useEffect(() => {
    buildLabelsHtml([SAMPLE], size).then(setHtml)
  }, [size])
  return (
    <div style={{ padding: 16, background: '#e2e8f0', minHeight: '100vh' }}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        {(['receipt', 'label4x6', 'halfA4'] as LabelSize[]).map((s) => (
          <button key={s} onClick={() => setSize(s)} style={{ padding: '6px 12px', background: size === s ? '#0f172a' : '#fff', color: size === s ? '#fff' : '#0f172a', borderRadius: 6 }}>
            {s}
          </button>
        ))}
      </div>
      <iframe title="label" srcDoc={html} style={{ width: 900, height: 700, background: '#fff', border: '1px solid #94a3b8' }} />
    </div>
  )
}
