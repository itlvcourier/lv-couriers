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
import {
  SMS_TEMPLATES,
  SMS_TEMPLATE_GROUPS,
  SMS_TEMPLATE_MAX_LENGTH,
  countSmsSegments,
  exampleVars,
  renderSmsTemplate,
  validateSmsTemplate,
  type SmsTemplateDef,
  type SmsTemplateGroup,
} from '@/lib/sms-templates'

type Override = { key: string; body: string; updated_at: string }

const AUDIENCE_STYLE: Record<string, string> = {
  Recipient: 'bg-info/10 text-info border-info/20',
  Business: 'bg-brand/10 text-brand border-brand/20',
  Driver: 'bg-success/10 text-success border-success/20',
  Any: 'bg-muted text-muted-foreground border-border',
}

async function fetchOverrides(): Promise<Record<string, Override>> {
  const res = await fetch('/api/admin/sms-templates', { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load templates')
  const { overrides } = (await res.json()) as { overrides: Override[] }
  return Object.fromEntries(overrides.map((o) => [o.key, o]))
}

export function AdminSmsTemplates() {
  const { data: overrides, isLoading, mutate } = useSWR('admin-sms-templates', fetchOverrides)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SmsTemplateDef | null>(null)

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

  const customizedCount = overrides ? Object.keys(overrides).length : 0

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
              customized={Boolean(overrides?.[editing.key])}
              onSaved={() => {
                mutate()
                setEditing(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function TemplateEditor({
  def,
  currentBody,
  customized,
  onSaved,
}: {
  def: SmsTemplateDef
  currentBody: string
  customized: boolean
  onSaved: () => void
}) {
  const [body, setBody] = useState(currentBody)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const error = validateSmsTemplate(def, body)
  const preview = renderSmsTemplate(body, exampleVars(def))
  const { segments, unicode } = countSmsSegments(preview)
  const dirty = body !== currentBody

  const insertVar = (name: string) => {
    const el = textareaRef.current
    const token = `{${name}}`
    if (!el) return setBody((b) => b + token)
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/sms-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: def.key, body }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Save failed')
      toast.success('Message saved')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    if (!customized) return setBody(def.defaultBody)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/sms-templates?key=${encodeURIComponent(def.key)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Reset failed')
      toast.success('Restored default message')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

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
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={SMS_TEMPLATE_MAX_LENGTH}
          aria-invalid={Boolean(error)}
          aria-describedby="sms-template-meta"
          className="font-mono text-sm leading-relaxed"
        />
        <div id="sms-template-meta" className="flex items-center justify-between gap-2 text-xs">
          <span className={error ? 'text-destructive' : 'text-muted-foreground'}>
            {error ?? `${preview.length} chars · ~${segments} SMS segment${segments !== 1 ? 's' : ''}${unicode ? ' (Unicode)' : ''}`}
          </span>
        </div>
      </div>

      {def.vars.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Variables</span>
          <p className="text-xs text-muted-foreground">Tap to insert at the cursor. Required ones must stay in the message.</p>
          <ul className="flex flex-col gap-1.5">
            {def.vars.map((v) => (
              <li key={v.name} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => insertVar(v.name)}
                  className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  {`{${v.name}}`}
                </button>
                <span className="pt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {v.description}
                  {v.required && <span className="ml-1 font-medium text-warning">Required</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Preview</span>
        <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{preview}</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={resetToDefault}
          disabled={saving || (!customized && body === def.defaultBody)}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset to default
        </Button>
        <Button type="button" onClick={save} disabled={saving || !dirty || Boolean(error)}>
          {saving ? <Spinner /> : 'Save message'}
        </Button>
      </div>
    </div>
  )
}
