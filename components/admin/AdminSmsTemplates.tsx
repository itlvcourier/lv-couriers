'use client'

import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChevronRight, RotateCcw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import {
  BUSINESS_TAGS,
  SMS_SIGNATURES,
  SMS_SIGNATURE_MAP,
  SMS_SIGNATURE_MAX_LENGTH,
  SMS_TEMPLATES,
  SMS_TEMPLATE_GROUPS,
  SMS_TEMPLATE_MAX_LENGTH,
  businessTagExamples,
  composeSms,
  countSmsSegments,
  exampleVars,
  signatureKeyFor,
  usesSignatureByDefault,
  validateSmsSignature,
  validateSmsTemplate,
  type SmsSignatureDef,
  type SmsTemplateDef,
  type SmsTemplateGroup,
  type SmsTemplateVar,
} from '@/lib/sms-templates'

type Override = { key: string; body: string | null; use_signature: boolean | null; updated_at: string }
type Overrides = Record<string, Override>

function signatureText(overrides: Overrides | undefined, def: SmsSignatureDef) {
  return overrides?.[def.key]?.body ?? def.defaultBody
}

function useInsertAtCursor(value: string, setValue: (v: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const insert = (name: string) => {
    const el = ref.current
    const token = `{${name}}`
    if (!el) return setValue(value + token)
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    setValue(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }
  return { ref, insert }
}

function TagList({ vars, onInsert, title }: { vars: SmsTemplateVar[]; onInsert: (name: string) => void; title: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <ul className="flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <li key={v.name}>
            <button
              type="button"
              onClick={() => onInsert(v.name)}
              title={v.description}
              className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:border-brand hover:text-brand"
            >
              {`{${v.name}}`}
              {v.required && <span className="sr-only"> (required)</span>}
              {v.required && <span className="ml-1 text-warning" aria-hidden>*</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const AUDIENCE_STYLE: Record<string, string> = {
  Recipient: 'bg-info/10 text-info border-info/20',
  Business: 'bg-brand/10 text-brand border-brand/20',
  Driver: 'bg-success/10 text-success border-success/20',
  Any: 'bg-muted text-muted-foreground border-border',
}

async function fetchOverrides(): Promise<Overrides> {
  const res = await fetch('/api/admin/sms-templates', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load templates')
  const { overrides } = (await res.json()) as { overrides: Override[] }
  return Object.fromEntries(overrides.map((o) => [o.key, o]))
}

export function AdminSmsTemplates() {
  const { data: overrides, isLoading, mutate } = useSWR('admin-sms-templates', fetchOverrides)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SmsTemplateDef | null>(null)
  const [editingSignature, setEditingSignature] = useState<SmsSignatureDef | null>(null)

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = SMS_TEMPLATES.filter(
      (t) =>
        !q ||
        t.label.toLowerCase().includes(q) ||
        t.audience.toLowerCase().includes(q) ||
        t.trigger.toLowerCase().includes(q) ||
        (overrides?.[t.key]?.body ?? t.defaultBody).toLowerCase().includes(q),
    )
    return (Object.keys(SMS_TEMPLATE_GROUPS) as SmsTemplateGroup[])
      .map((g) => ({ group: g, items: matches.filter((t) => t.group === g) }))
      .filter((g) => g.items.length > 0)
  }, [search, overrides])

  const customizedCount = overrides ? Object.keys(overrides).filter((k) => !SMS_SIGNATURE_MAP[k as never]).length : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Edit the text of every automated SMS. Changes apply to new messages within 30 seconds.
          {customizedCount > 0 && ` ${customizedCount} customized.`}
        </p>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages"
            aria-label="Search SMS templates"
            className="pl-9"
          />
        </div>
      </div>

      {!isLoading && !search.trim() && (
        <section className="flex flex-col gap-2" aria-labelledby="sms-group-signatures">
          <h3 id="sms-group-signatures" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Signatures
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            Added to the end of messages. Use tags like {'{business_email}'} and each business&apos;s own details are
            filled in. Blank details are skipped automatically.
          </p>
          <Card className="overflow-hidden py-0">
            <CardContent className="divide-y divide-border p-0">
              {SMS_SIGNATURES.map((s) => {
                const text = signatureText(overrides, s)
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setEditingSignature(s)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                        <Badge variant="outline" className={cn('text-[10px]', AUDIENCE_STYLE[s.audience])}>
                          {s.audience}
                        </Badge>
                        {overrides?.[s.key] && (
                          <Badge variant="outline" className="border-warning/20 bg-warning/10 text-[10px] text-warning">
                            Customized
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 whitespace-pre-line font-mono text-xs leading-relaxed text-foreground/70">
                        {text || 'No signature'}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        groups.map(({ group, items }) => (
          <section key={group} className="flex flex-col gap-2" aria-labelledby={`sms-group-${group}`}>
            <h3 id={`sms-group-${group}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {SMS_TEMPLATE_GROUPS[group]}
            </h3>
            <Card className="overflow-hidden py-0">
              <CardContent className="divide-y divide-border p-0">
                {items.map((t) => {
                  const customized = Boolean(overrides?.[t.key])
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setEditing(t)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{t.label}</span>
                          <Badge variant="outline" className={cn('text-[10px]', AUDIENCE_STYLE[t.audience])}>
                            {t.audience}
                          </Badge>
                          {customized && (
                            <Badge variant="outline" className="border-warning/20 bg-warning/10 text-[10px] text-warning">
                              Customized
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.trigger}</p>
                        <p className="line-clamp-2 text-xs leading-relaxed text-foreground/70">
                          {overrides?.[t.key]?.body ?? t.defaultBody}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </section>
        ))
      )}

      {!isLoading && groups.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No messages match your search.</p>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {editing && (
            <TemplateEditor
              key={editing.key}
              def={editing}
              currentBody={overrides?.[editing.key]?.body ?? editing.defaultBody}
              currentUseSignature={overrides?.[editing.key]?.use_signature ?? usesSignatureByDefault(editing)}
              signature={(() => {
                const k = signatureKeyFor(editing.audience)
                return k ? signatureText(overrides, SMS_SIGNATURE_MAP[k]) : null
              })()}
              customized={Boolean(overrides?.[editing.key])}
              onSaved={() => {
                mutate()
                setEditing(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={editingSignature !== null} onOpenChange={(open) => !open && setEditingSignature(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {editingSignature && (
            <SignatureEditor
              key={editingSignature.key}
              def={editingSignature}
              current={signatureText(overrides, editingSignature)}
              customized={Boolean(overrides?.[editingSignature.key])}
              onSaved={() => {
                mutate()
                setEditingSignature(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function MessageBubble({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">Preview</span>
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{text}</p>
      </div>
    </div>
  )
}

function useSaveTemplate(onSaved: () => void) {
  const [saving, setSaving] = useState(false)
  const run = async (request: () => Promise<Response>, success: string) => {
    setSaving(true)
    try {
      const res = await request()
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Save failed')
      toast.success(success)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }
  const put = (payload: Record<string, unknown>) =>
    run(
      () =>
        fetch('/api/admin/sms-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      'Saved',
    )
  const reset = (key: string) =>
    run(() => fetch(`/api/admin/sms-templates?key=${encodeURIComponent(key)}`, { method: 'DELETE' }), 'Restored default')
  return { saving, put, reset }
}

function TemplateEditor({
  def,
  currentBody,
  currentUseSignature,
  signature,
  customized,
  onSaved,
}: {
  def: SmsTemplateDef
  currentBody: string
  currentUseSignature: boolean
  signature: string | null
  customized: boolean
  onSaved: () => void
}) {
  const [body, setBody] = useState(currentBody)
  const [useSignature, setUseSignature] = useState(currentUseSignature)
  const { saving, put, reset } = useSaveTemplate(onSaved)
  const { ref, insert } = useInsertAtCursor(body, setBody)

  const error = validateSmsTemplate(def, body)
  const preview = composeSms(body, useSignature ? signature : null, { ...businessTagExamples(), ...exampleVars(def) })
  const { segments, unicode } = countSmsSegments(preview)
  const dirty = body !== currentBody || useSignature !== currentUseSignature
  const isDefault = body === def.defaultBody && useSignature === usesSignatureByDefault(def)

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <SheetHeader className="px-0">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {def.label}
          <Badge variant="outline" className={cn('text-[10px]', AUDIENCE_STYLE[def.audience])}>
            {def.audience}
          </Badge>
        </SheetTitle>
        <SheetDescription>Sent when: {def.trigger.toLowerCase()}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-2">
        <label htmlFor="sms-template-body" className="text-sm font-medium text-foreground">
          Message
        </label>
        <Textarea
          id="sms-template-body"
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={SMS_TEMPLATE_MAX_LENGTH}
          aria-invalid={Boolean(error)}
          aria-describedby="sms-template-meta"
          className="font-mono text-sm leading-relaxed"
        />
        <span id="sms-template-meta" className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? `${preview.length} chars · ~${segments} SMS segment${segments !== 1 ? 's' : ''}${unicode ? ' (Unicode)' : ''}`}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-foreground">Tags</span>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Tap to insert at the cursor. Tags marked <span className="text-warning">*</span> must stay in the message. Hover
          a tag for details.
        </p>
        {def.vars.length > 0 && <TagList title="This message" vars={def.vars} onInsert={insert} />}
        <TagList title="Business details" vars={BUSINESS_TAGS} onInsert={insert} />
      </div>

      {signature !== null && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="sms-use-signature" className="text-sm font-medium text-foreground">
              Add {def.audience.toLowerCase()} signature
            </label>
            <p className="whitespace-pre-line font-mono text-xs leading-relaxed text-muted-foreground">
              {signature || 'Signature is empty'}
            </p>
          </div>
          <Switch id="sms-use-signature" checked={useSignature} onCheckedChange={setUseSignature} />
        </div>
      )}

      <MessageBubble text={preview} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (customized) return reset(def.key)
            setBody(def.defaultBody)
            setUseSignature(usesSignatureByDefault(def))
          }}
          disabled={saving || (!customized && isDefault)}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset to default
        </Button>
        <Button type="button" onClick={() => put({ key: def.key, body, useSignature })} disabled={saving || !dirty || Boolean(error)}>
          {saving ? <Spinner /> : 'Save message'}
        </Button>
      </div>
    </div>
  )
}

function SignatureEditor({
  def,
  current,
  customized,
  onSaved,
}: {
  def: SmsSignatureDef
  current: string
  customized: boolean
  onSaved: () => void
}) {
  const [body, setBody] = useState(current)
  const { saving, put, reset } = useSaveTemplate(onSaved)
  const { ref, insert } = useInsertAtCursor(body, setBody)
  const error = validateSmsSignature(body)
  const preview = composeSms('Your delivery update goes here.', body, businessTagExamples())

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <SheetHeader className="px-0">
        <SheetTitle>{def.label}</SheetTitle>
        <SheetDescription>{def.description}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-2">
        <label htmlFor="sms-signature-body" className="text-sm font-medium text-foreground">
          Signature
        </label>
        <Textarea
          id="sms-signature-body"
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={SMS_SIGNATURE_MAX_LENGTH}
          aria-invalid={Boolean(error)}
          aria-describedby="sms-signature-meta"
          placeholder="Leave empty for no signature"
          className="font-mono text-sm leading-relaxed"
        />
        <span id="sms-signature-meta" className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? `${body.length}/${SMS_SIGNATURE_MAX_LENGTH} characters. Lines with an empty tag are skipped.`}
        </span>
      </div>

      <TagList title="Business details" vars={BUSINESS_TAGS} onInsert={insert} />

      <MessageBubble text={preview} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (customized ? reset(def.key) : setBody(def.defaultBody))}
          disabled={saving || (!customized && body === def.defaultBody)}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset to default
        </Button>
        <Button type="button" onClick={() => put({ key: def.key, body })} disabled={saving || body === current || Boolean(error)}>
          {saving ? <Spinner /> : 'Save signature'}
        </Button>
      </div>
    </div>
  )
}
