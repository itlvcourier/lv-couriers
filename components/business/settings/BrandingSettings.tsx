'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Panel, jsonFetcher, sendJson } from './shared'

type Branding = { brandColor: string | null; brandLogoUrl: string | null; trackingMessage: string | null }

export function BrandingSettings() {
  const { data, mutate } = useSWR<{ branding: Branding }>('/api/business/preferences', jsonFetcher)
  const [b, setB] = useState<Branding>({ brandColor: '', brandLogoUrl: '', trackingMessage: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) setB({
      brandColor: data.branding.brandColor ?? '',
      brandLogoUrl: data.branding.brandLogoUrl ?? '',
      trackingMessage: data.branding.trackingMessage ?? '',
    })
  }, [data])

  const save = async () => {
    setSaving(true)
    try {
      await sendJson('/api/business/preferences', 'PATCH', { branding: b })
      toast.success('Tracking page updated')
      void mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const color = /^#[0-9a-fA-F]{6}$/.test(b.brandColor ?? '') ? b.brandColor! : undefined

  return (
    <Panel
      title="Branded tracking page"
      description="Recipients see your logo, colour and message on the tracking link we text them."
      action={<Button size="sm" onClick={save} disabled={saving || !data}>{saving ? 'Saving…' : 'Save'}</Button>}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-logo">Logo URL</Label>
            <Input id="brand-logo" placeholder="https://…/logo.png" value={b.brandLogoUrl ?? ''} onChange={(e) => setB({ ...b, brandLogoUrl: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-color">Accent colour</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick accent colour"
                value={color ?? '#3b6cf6'}
                onChange={(e) => setB({ ...b, brandColor: e.target.value })}
                className="h-9 w-10 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <Input id="brand-color" placeholder="#1a2b3c" value={b.brandColor ?? ''} onChange={(e) => setB({ ...b, brandColor: e.target.value })} className="font-mono" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-msg">Message to recipients</Label>
            <Textarea id="brand-msg" rows={3} maxLength={280} placeholder="Thanks for ordering with us. Questions? Call 555-0100." value={b.trackingMessage ?? ''} onChange={(e) => setB({ ...b, trackingMessage: e.target.value })} />
          </div>
        </div>

        <div aria-label="Preview" className="flex flex-col overflow-hidden rounded-lg border border-border bg-background">
          <div className="h-1" style={{ background: color ?? 'var(--brand)' }} />
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              {b.brandLogoUrl?.startsWith('https://') ? (
                <img src={b.brandLogoUrl} alt="Logo preview" className="h-8 max-w-32 object-contain" />
              ) : (
                <div className="h-8 w-24 rounded bg-muted" aria-hidden />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your delivery</p>
              <p className="text-lg font-semibold text-foreground">Out for delivery</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 rounded-full" style={{ background: color ?? 'var(--brand)' }} />
            </div>
            {b.trackingMessage && <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{b.trackingMessage}</p>}
          </div>
        </div>
      </div>
    </Panel>
  )
}
