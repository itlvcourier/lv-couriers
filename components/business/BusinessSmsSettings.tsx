'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ChevronRight, MessageSquareText, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { authedJson } from '@/lib/api-client'
import {
  BUSINESS_TAGS,
  CUSTOMER_TAGS,
  SMS_SIGNATURE_MAX_LENGTH,
  composeSms,
  validateSmsSignature,
} from '@/lib/sms-templates'

type Settings = {
  email: string | null
  website: string | null
  google_review_link: string | null
  sms_signature: string | null
  sms_note: string | null
}
type Response = { settings: Settings; defaultSignature: string }

export function BusinessSmsSettings({
  businessId,
  businessName,
  businessPhone,
}: {
  businessId: string
  businessName: string
  businessPhone?: string | null
}) {
  const [open, setOpen] = useState(false)
  const { data, mutate } = useSWR(open ? ['business-sms-settings', businessId] : null, () =>
    authedJson<Response>(`/api/business/sms-settings?businessId=${encodeURIComponent(businessId)}`),
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="flex items-center gap-3">
          <MessageSquareText className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span className="flex flex-col">
            <span className="text-sm">Customer text messages</span>
            <span className="text-xs text-muted-foreground">Signature and contact details in your SMS</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Customer text messages</SheetTitle>
            <SheetDescription>
              Choose what appears at the end of texts we send your customers. These settings apply to every location under {businessName}; you only need to set them once.
            </SheetDescription>
          </SheetHeader>
          {data ? (
            <SmsSettingsForm
              businessId={businessId}
              tagValues={{ business_name: businessName, business_phone: businessPhone ?? '' }}
              initial={data.settings}
              defaultSignature={data.defaultSignature}
              onSaved={() => {
                mutate()
                setOpen(false)
              }}
            />
          ) : (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function SmsSettingsForm({
  businessId,
  tagValues,
  initial,
  defaultSignature,
  onSaved,
}: {
  businessId: string
  tagValues: Record<string, string>
  initial: Settings
  defaultSignature: string
  onSaved: () => void
}) {
  const [email, setEmail] = useState(initial.email ?? '')
  const [website, setWebsite] = useState(initial.website ?? '')
  const [googleReviewLink, setGoogleReviewLink] = useState(initial.google_review_link ?? '')
  const [note, setNote] = useState(initial.sms_note ?? '')
  const [signature, setSignature] = useState(initial.sms_signature ?? '')
  const [saving, setSaving] = useState(false)
  const sigRef = useRef<HTMLTextAreaElement>(null)

  const effectiveSignature = signature.trim() || defaultSignature
  const sigError = validateSmsSignature(signature)
  const preview = composeSms('Your order is on the way! Track it here: lvc.link/t/ABC123', effectiveSignature, {
    ...tagValues,
    business_email: email,
    business_website: website,
    google_review_link: googleReviewLink,
    business_note: note,
    recipient_name: 'Jane Doe',
    recipient_first_name: 'Jane',
    recipient_last_name: 'Doe',
    dropoff_address: '88 Queen Ave',
    tracking_url: 'https://atria360.ca/track/ABC123',
    location_name: 'Main location',
    location_phone: tagValues.business_phone,
    location_address: '',
  })

  const insertTag = (name: string) => {
    const el = sigRef.current
    const token = `{${name}}`
    const base = signature || defaultSignature
    const start = el?.selectionStart ?? base.length
    const end = el?.selectionEnd ?? base.length
    setSignature(base.slice(0, start) + token + base.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await authedJson('/api/business/sms-settings', {
        method: 'PUT',
        body: JSON.stringify({ businessId, email, website, googleReviewLink, smsNote: note, smsSignature: signature }),
      })
      toast.success('Text message settings saved')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="sms-biz-email">Contact email</Label>
        <Input
          id="sms-biz-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hello@yourbusiness.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sms-biz-website">Website</Label>
        <Input
          id="sms-biz-website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="yourbusiness.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sms-google-review">Google review link</Label>
        <Input
          id="sms-google-review"
          type="url"
          value={googleReviewLink}
          onChange={(e) => setGoogleReviewLink(e.target.value)}
          placeholder="https://g.page/r/your-business/review"
        />
        <p className="text-xs text-muted-foreground">Add the link from your Google Business Profile. Use {'{google_review_link}'} in a customer message.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sms-biz-note">Short note</Label>
        <Input
          id="sms-biz-note"
          value={note}
          maxLength={160}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Open Mon–Sat 9am–6pm"
        />
        <p className="text-xs text-muted-foreground">Shown wherever the {'{business_note}'} tag is used.</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="sms-biz-signature">Signature</Label>
          {signature && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setSignature('')}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Use default
            </Button>
          )}
        </div>
        <Textarea
          id="sms-biz-signature"
          ref={sigRef}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          rows={3}
          maxLength={SMS_SIGNATURE_MAX_LENGTH}
          placeholder={defaultSignature || 'No signature'}
          aria-invalid={Boolean(sigError)}
          aria-describedby="sms-biz-signature-hint"
          className="font-mono text-sm leading-relaxed"
        />
        <p id="sms-biz-signature-hint" className={sigError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {sigError ?? 'Leave empty to use the default. Blank details are skipped automatically.'}
        </p>
        <p className="text-xs font-medium text-muted-foreground">Customer details</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Insert customer tag">
          {CUSTOMER_TAGS.map((t) => (
            <li key={t.name}>
              <button
                type="button"
                onClick={() => insertTag(t.name)}
                title={t.description}
                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:border-brand hover:text-brand"
              >
                {`{${t.name}}`}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs font-medium text-muted-foreground">Business details</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Insert a business tag">
          {BUSINESS_TAGS.map((t) => (
            <li key={t.name}>
              <button
                type="button"
                onClick={() => insertTag(t.name)}
                title={t.description}
                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:border-brand hover:text-brand"
              >
                {`{${t.name}}`}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Preview</span>
        <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{preview}</p>
        </div>
      </div>

      <Button type="button" onClick={save} disabled={saving || Boolean(sigError)}>
        {saving ? <Spinner /> : 'Save'}
      </Button>
    </div>
  )
}
