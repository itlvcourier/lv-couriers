'use client'

import { useMemo, useState } from 'react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ContactRound,
  Search,
  MapPin,
  Phone,
  KeyRound,
  Trash2,
  UserRound,
  Clock,
  Package,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import type { SavedContact } from '@/lib/types'

interface RecipientPickerProps {
  businessId: string
  onSelect: (contact: SavedContact) => void
  triggerLabel?: string
}

export function RecipientPicker({
  businessId,
  onSelect,
  triggerLabel = 'Saved Recipients',
}: RecipientPickerProps) {
  const { getSavedContactsForBusiness, deleteSavedContact } = useApp()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const contacts = useMemo(
    () => getSavedContactsForBusiness(businessId),
    [getSavedContactsForBusiness, businessId],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.buzzCode?.toLowerCase().includes(q),
    )
  }, [contacts, query])

  const handleSelect = (contact: SavedContact) => {
    onSelect(contact)
    setOpen(false)
    setQuery('')
  }

  const handleDelete = (e: React.MouseEvent, contact: SavedContact) => {
    e.stopPropagation()
    deleteSavedContact(contact.id)
    toast.success(`Removed ${contact.name}`)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 h-8 px-2 sm:px-3 sm:h-9 sm:gap-2 shrink-0"
      >
        <ContactRound className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">{triggerLabel}</span>
        <span className="sm:hidden">Saved</span>
        {contacts.length > 0 && (
          <Badge variant="secondary" className="h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
            {contacts.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-3 border-b">
            <DialogTitle className="text-base flex items-center gap-2">
              <ContactRound className="w-4 h-4" />
              Saved Recipients
            </DialogTitle>
            <DialogDescription className="text-xs">
              Choose a contact to pre-fill the delivery form.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, address, phone..."
                className="pl-9 h-10"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {contacts.length === 0 ? (
              <EmptyState
                title="No saved recipients yet"
                body='When you post a delivery with a recipient name, tick "Save recipient to address book" and it will appear here next time.'
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No matches"
                body={`No saved recipient matches "${query}".`}
              />
            ) : (
              <ul className="space-y-2 pt-1">
                {filtered.map(contact => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(contact)}
                      className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/40 transition-colors p-3 group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <UserRound className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {contact.name}
                            </p>
                            {contact.useCount > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {contact.useCount}{' '}
                                {contact.useCount === 1 ? 'delivery' : 'deliveries'}
                                {contact.lastUsedAt && (
                                  <>
                                    <span className="text-muted-foreground/50">·</span>
                                    <Clock className="w-3 h-3" />
                                    <span className="truncate">
                                      {formatDistanceToNow(new Date(contact.lastUsedAt), {
                                        addSuffix: true,
                                      })}
                                    </span>
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={e => handleDelete(e, contact)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleDelete(e as unknown as React.MouseEvent, contact) }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                          aria-label={`Delete ${contact.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="space-y-1 pl-10">
                        <div className="flex items-start gap-1.5 text-sm text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="line-clamp-1">{contact.address}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.buzzCode && (
                            <span className="flex items-center gap-1">
                              <KeyRound className="w-3 h-3" />
                              Buzz {contact.buzzCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
        <ContactRound className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-sm">{body}</p>
    </div>
  )
}
