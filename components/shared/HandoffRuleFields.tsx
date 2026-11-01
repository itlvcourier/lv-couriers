'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HANDOFF_RULES, HANDOFF_RULE_HINTS, HANDOFF_RULE_LABELS, type HandoffRule } from '@/lib/handoff'

export interface HandoffValue {
  handoffRule: HandoffRule
  handoffRequireId: boolean
  handoffNamedPerson: string
  handoffNamedRelationship: string
  handoffLocationNote: string
}

export const DEFAULT_HANDOFF: HandoffValue = {
  handoffRule: 'door',
  handoffRequireId: false,
  handoffNamedPerson: '',
  handoffNamedRelationship: '',
  handoffLocationNote: '',
}

interface Props {
  value: HandoffValue
  onChange: (next: HandoffValue) => void
  idPrefix?: string
}

export function HandoffRuleFields({ value, onChange, idPrefix = 'handoff' }: Props) {
  const set = <K extends keyof HandoffValue>(key: K, v: HandoffValue[K]) => onChange({ ...value, [key]: v })
  const showLocation = value.handoffRule === 'reception' || value.handoffRule === 'security' || value.handoffRule === 'door'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-rule`} className="text-sm font-medium text-foreground">
          Handoff instructions
        </Label>
        <Select value={value.handoffRule} onValueChange={v => set('handoffRule', v as HandoffRule)}>
          <SelectTrigger id={`${idPrefix}-rule`} className="bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HANDOFF_RULES.map(r => (
              <SelectItem key={r} value={r}>
                {HANDOFF_RULE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground leading-relaxed">{HANDOFF_RULE_HINTS[value.handoffRule]}</p>
      </div>

      {value.handoffRule === 'recipient_or_named' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-named`} className="text-sm">
              Other person allowed
            </Label>
            <Input
              id={`${idPrefix}-named`}
              placeholder="e.g. Priya Sharma"
              maxLength={80}
              value={value.handoffNamedPerson}
              onChange={e => set('handoffNamedPerson', e.target.value)}
              className="bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-rel`} className="text-sm">
              Relationship
            </Label>
            <Input
              id={`${idPrefix}-rel`}
              placeholder="e.g. Wife, son, caregiver"
              maxLength={60}
              value={value.handoffNamedRelationship}
              onChange={e => set('handoffNamedRelationship', e.target.value)}
              className="bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl"
            />
          </div>
        </div>
      )}

      {showLocation && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-loc`} className="text-sm">
            Location details (optional)
          </Label>
          <Input
            id={`${idPrefix}-loc`}
            placeholder={value.handoffRule === 'door' ? 'e.g. Side door, behind planter' : 'e.g. Front desk, Tower B'}
            maxLength={200}
            value={value.handoffLocationNote}
            onChange={e => set('handoffLocationNote', e.target.value)}
            className="bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl"
          />
        </div>
      )}

      {value.handoffRule !== 'door' && (
        <div className="flex items-start gap-2">
          <Checkbox
            id={`${idPrefix}-id`}
            checked={value.handoffRequireId}
            onCheckedChange={c => set('handoffRequireId', c === true)}
          />
          <Label htmlFor={`${idPrefix}-id`} className="text-sm leading-relaxed text-foreground">
            Check photo ID at handoff (driver records ID type and last 4 digits)
          </Label>
        </div>
      )}
    </div>
  )
}

/** Client-side check mirroring the server rule. Returns an error message or null. */
export function validateHandoff(v: HandoffValue): string | null {
  if (v.handoffRule === 'recipient_or_named' && !v.handoffNamedPerson.trim()) {
    return 'Enter the name of the other person who can receive it'
  }
  return null
}
