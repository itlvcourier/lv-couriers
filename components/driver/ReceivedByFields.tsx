'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ID_TYPES,
  RECEIVED_BY_LABELS,
  RECEIVED_BY_TYPES,
  allowedReceiversForRule,
  isHandoffRule,
  type ReceivedByType,
} from '@/lib/handoff'
import type { Delivery } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface ReceiverValue {
  type: ReceivedByType | null
  name: string
  relationship: string
  idType: string
  idLast4: string
}

const fieldCls = 'bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl'
const NEEDS_NAME = new Set<ReceivedByType>(['named_person', 'other_person', 'reception', 'security'])

interface Props {
  delivery: Delivery
  value: ReceiverValue
  onChange: (v: ReceiverValue) => void
}

export function ReceivedByFields({ delivery, value, onChange }: Props) {
  const rule = isHandoffRule(delivery.handoffRule) ? delivery.handoffRule : 'door'
  const allowed = new Set(allowedReceiversForRule(rule))
  const options = RECEIVED_BY_TYPES.filter(t => t !== 'named_person' || !!delivery.handoffNamedPerson)
  const set = <K extends keyof ReceiverValue>(k: K, v: ReceiverValue[K]) => onChange({ ...value, [k]: v })
  const showId = !!value.type && value.type !== 'door'

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-semibold text-foreground">Who received it?</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map(t => {
          const ok = allowed.has(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  type: t,
                  name: t === 'named_person' ? (delivery.handoffNamedPerson ?? '') : t === 'recipient' ? (delivery.recipientName ?? '') : value.name,
                  relationship: t === 'named_person' ? (delivery.handoffNamedRelationship ?? '') : value.relationship,
                })
              }
              aria-pressed={value.type === t}
              className={cn(
                'flex flex-col items-start rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                value.type === t
                  ? 'border-[var(--accent-green)] bg-[var(--accent-green)]/10 text-foreground'
                  : 'border-[var(--border-color)] bg-[var(--bg-card-2)] text-foreground',
              )}
            >
              <span className="font-medium">{RECEIVED_BY_LABELS[t]}</span>
              {!ok && <span className="text-xs text-amber-500">Needs approval</span>}
            </button>
          )
        })}
      </div>
      {value.type && !allowed.has(value.type) && (
        <p className="text-xs leading-relaxed text-amber-500">
          Not allowed by the instructions unless the recipient approved it (by text, phone, or in person) in the handoff panel.
        </p>
      )}

      {value.type && NEEDS_NAME.has(value.type) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-name" className="text-xs">
              Name
            </Label>
            <Input id="rb-name" value={value.name} maxLength={80} onChange={e => set('name', e.target.value)} className={fieldCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-rel" className="text-xs">
              Relationship / role
            </Label>
            <Input id="rb-rel" value={value.relationship} maxLength={60} onChange={e => set('relationship', e.target.value)} className={fieldCls} />
          </div>
        </div>
      )}

      {showId && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-idtype" className="text-xs">
              {delivery.handoffRequireId ? 'ID type (required)' : 'ID type (optional)'}
            </Label>
            <Select value={value.idType} onValueChange={v => set('idType', v)}>
              <SelectTrigger id="rb-idtype" className={fieldCls}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map(t => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-last4" className="text-xs">
              Last 4 of ID
            </Label>
            <Input
              id="rb-last4"
              inputMode="text"
              autoComplete="off"
              maxLength={4}
              value={value.idLast4}
              onChange={e => set('idLast4', e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))}
              className={fieldCls}
            />
          </div>
        </div>
      )}
    </fieldset>
  )
}
