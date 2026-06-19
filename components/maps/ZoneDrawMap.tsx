'use client'

import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui/spinner'
import type { ZoneDrawMapProps } from './ZoneDrawMapInner'

const ZoneDrawMapInner = dynamic(() => import('./ZoneDrawMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted/50 flex items-center justify-center">
      <Spinner className="w-6 h-6" />
    </div>
  ),
})

export function ZoneDrawMap(props: ZoneDrawMapProps) {
  return <ZoneDrawMapInner {...props} />
}
