'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/context'
import type { Invoice, InvoiceStatus, Dispute, PaymentDetails, InvoiceEmailEvent, InvoiceEventType } from '@/lib/types'
import { formatCurrency } from '@/lib/billing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Mail,
  MailWarning,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  SkipForward,
  TrendingUp,
  X,
  Zap,
  AlertCircle,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// Status styling
// ============================================================================

const statusStyles: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  sent: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  paid: 'bg-green-500/15 text-green-300 border-green-500/30',
  overdue: 'bg-red-500/15 text-red-300 border-red-500/30',
  disputed: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  escalated: 'bg-red-600/20 text-red-400 border-red-600/40 font-semibold',
}

const statusLeftBorder: Record<InvoiceStatus, string> = {
  draft: 'border-l-gray-500',
  sent: 'border-l-blue-500',
  paid: 'border-l-green-500',
  overdue: 'border-l-red-500',
  disputed: 'border-l-yellow-500',
  escalated: 'border-l-red-600',
}

// Escalated invoices are treated as a view that includes 'escalated' status
type InvoiceFilter = InvoiceStatus | 'all'

const filterLabels: Record<InvoiceFilter, string> = {
  all: 'All',
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  disputed: 'Disputed',
  escalated: 'Escalated',
}

function daysBetween(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function humanDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const hours = Math.round(diffMs / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(diffMs / 86400000)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

// ============================================================================
// AdminInvoices (main)
// ============================================================================

export function AdminInvoices() {
  const {
    invoices,
    settings,
    businesses,
    rateCards,
    generateInvoice,
    generateBusinessInvoices,
    markInvoicePaid,
    disputes,
    resolveDispute,
    unmatchedPayments,
    matchPayment,
    toggleAutoSend,
    sendSingleInvoice,
    sendAllDraftInvoices,
    pauseReminders,
    resumeReminders,
    skipNextReminder,
    resendBouncedInvoice,
    updateInvoiceBillingEmail,
    updateInvoiceBackupEmail,
  } = useApp()

  const [filter, setFilter] = useState<InvoiceFilter>(() => {
    if (typeof window === 'undefined') return 'all'
    try {
      const v = sessionStorage.getItem('doms.invoices.initialStatus') as InvoiceFilter | null
      if (v) {
        sessionStorage.removeItem('doms.invoices.initialStatus')
        return v
      }
    } catch {
      // ignore
    }
    return 'all'
  })
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showMarkPaidFor, setShowMarkPaidFor] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSendModal, setShowSendModal] = useState<{ invoiceIds: string[] } | null>(null)
  const [showUnmatchedPayments, setShowUnmatchedPayments] = useState(true)
  const [showAutoSendStatus, setShowAutoSendStatus] = useState(true)

  // Always derive the current invoice from context - preserves updates when actions fire
  const selectedInvoice = useMemo(
    () => invoices.find(i => i.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  )
  const markPaidInvoice = useMemo(
    () => invoices.find(i => i.id === showMarkPaidFor) || null,
    [invoices, showMarkPaidFor]
  )
  const sendModalInvoices = useMemo(() => {
    if (!showSendModal) return []
    return invoices.filter(i => showSendModal.invoiceIds.includes(i.id))
  }, [invoices, showSendModal])

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(inv => {
        if (filter === 'all') return true
        return inv.status === filter
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [invoices, filter])

  // Counts per status
  const counts = useMemo(() => {
    const base: Record<InvoiceFilter, number> = {
      all: invoices.length,
      draft: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      disputed: 0,
      escalated: 0,
    }
    for (const inv of invoices) base[inv.status] += 1
    return base
  }, [invoices])

  const draftInvoices = useMemo(() => invoices.filter(i => i.status === 'draft'), [invoices])
  const draftTotal = useMemo(() => draftInvoices.reduce((s, i) => s + i.total, 0), [draftInvoices])

  // Pending payments
  const pendingPayments = unmatchedPayments.filter(p => !p.matchedInvoiceId)

  const navigateToSettings = () => {
    window.dispatchEvent(new CustomEvent('doms:navigate-admin', { detail: 'settings' }))
    // Try to scroll to the invoice settings card after navigation
    setTimeout(() => {
      const el = document.getElementById('invoice-settings')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleSendSingle = async (invoice: Invoice, backupEmail?: string) => {
    const result = await sendSingleInvoice(invoice.id, backupEmail ? { backupEmail } : undefined)
    if (result.ok) {
      toast.success(`Invoice ${invoice.invoiceNumber} sent`)
      setShowSendModal(null)
    } else {
      toast.error(result.reason || 'Could not send invoice')
    }
  }

  const handleSendAll = () => {
    const { sent, skipped } = sendAllDraftInvoices()
    if (sent.length > 0) {
      toast.success(
        `${sent.length} invoice${sent.length > 1 ? 's' : ''} sent${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}`
      )
    } else {
      toast.error('No invoices could be sent — check emails and bounce status')
    }
    setShowSendModal(null)
  }

  const handleResendBounced = (invoice: Invoice, newEmail: string) => {
    resendBouncedInvoice(invoice.id, newEmail)
    toast.success(`Invoice resent to ${newEmail}`)
  }

  const handleExportCSV = () => {
    const headers = ['Invoice #', 'Business', 'Period', 'Due Date', 'Subtotal', 'GST', 'Total', 'Status', 'Created']
    const rows = filteredInvoices.map(inv => {
      const business = businesses.find(b => b.id === inv.businessId)
      return [
        inv.invoiceNumber,
        business?.name || 'Unknown',
        `${new Date(inv.periodStart).toLocaleDateString()} - ${new Date(inv.periodEnd).toLocaleDateString()}`,
        new Date(inv.dueDate).toLocaleDateString(),
        inv.subtotal.toFixed(2),
        inv.gstAmount.toFixed(2),
        inv.total.toFixed(2),
        inv.status,
        new Date(inv.createdAt).toLocaleDateString(),
      ]
    })
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `invoices-${filter}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredInvoices.length} invoices`)
  }

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const handleBulkSend = () => {
    if (selectedIds.size === 0) return
    setShowSendModal({ invoiceIds: Array.from(selectedIds) })
  }

  const handleBulkMarkPaid = async () => {
    if (selectedIds.size === 0) return
    const selectedInvoices = filteredInvoices.filter(inv => selectedIds.has(inv.id))
    const draftOrSent = selectedInvoices.filter(inv => inv.status === 'draft' || inv.status === 'sent' || inv.status === 'overdue')
    
    for (const inv of draftOrSent) {
      markInvoicePaid(inv.id, {
        method: 'other',
        amountReceived: inv.total,
        date: new Date().toISOString(),
        reference: 'Bulk marked as paid',
      })
    }
    
    toast.success(`Marked ${draftOrSent.length} invoices as paid`)
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-6">
      {/* Auto-send status indicator */}
      {showAutoSendStatus && (
        <AutoSendStatusIndicator
          autoSend={settings.autoSendInvoices}
          onToggle={() => {
            toggleAutoSend()
            toast.success(
              settings.autoSendInvoices
                ? 'Auto-send turned OFF'
                : 'Auto-send turned ON'
            )
          }}
          onSettings={navigateToSettings}
          onDismiss={() => setShowAutoSendStatus(false)}
        />
      )}

      {/* Draft banner - only when auto-send is off AND there are drafts */}
      {!settings.autoSendInvoices && draftInvoices.length > 0 && (
        <DraftBanner
          count={draftInvoices.length}
          total={draftTotal}
          onReviewAll={() => setFilter('draft')}
          onSendAll={() =>
            setShowSendModal({ invoiceIds: draftInvoices.map(i => i.id) })
          }
          onChangeAutoSend={navigateToSettings}
        />
      )}

      {/* Unmatched Payments Banner */}
      {pendingPayments.length > 0 && showUnmatchedPayments && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-base text-yellow-200">
                  {pendingPayments.length} unmatched payment{pendingPayments.length > 1 ? 's' : ''} &mdash; action required
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowUnmatchedPayments(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPayments.map(payment => (
              <UnmatchedPaymentRow
                key={payment.id}
                payment={payment}
                invoices={invoices.filter(i => i.status !== 'paid')}
                onMatch={(invoiceId) => {
                  matchPayment(payment.id, invoiceId)
                  toast.success('Payment matched successfully')
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Invoices</h2>
          <p className="text-sm text-muted-foreground">{filteredInvoices.length} invoice{filteredInvoices.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setShowGenerateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Invoice
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as InvoiceFilter)}>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="bg-muted/30 w-max min-w-full sm:min-w-0">
            {(Object.keys(filterLabels) as InvoiceFilter[]).map(key => (
              <TabsTrigger key={key} value={key} className="gap-1 text-xs sm:text-sm px-2 sm:px-3">
                <span className="hidden sm:inline">{filterLabels[key]}</span>
                <span className="sm:hidden">{key === 'all' ? 'All' : key === 'disputed' ? 'Disp' : key === 'escalated' ? 'Esc' : filterLabels[key].slice(0, 4)}</span>
                {counts[key] > 0 && (
                  <span className="rounded-full bg-muted text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 min-w-[16px] sm:min-w-[18px] text-center">
                    {counts[key]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Bulk Actions Bar */}
      {filteredInvoices.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
          <Checkbox
            checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </span>
          {selectedIds.size > 0 && (
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={handleBulkSend}>
                <Send className="w-4 h-4 mr-1" />
                Send ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkMarkPaid}>
                <Check className="w-4 h-4 mr-1" />
                Mark Paid ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Invoice List */}
      <div className="space-y-3">
        {filteredInvoices.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 text-center text-muted-foreground">
              No invoices found
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map(invoice => (
            <div key={invoice.id} className="flex items-start gap-3">
              <Checkbox
                checked={selectedIds.has(invoice.id)}
                onCheckedChange={() => toggleSelect(invoice.id)}
                className="mt-4"
              />
              <div className="flex-1">
                <InvoiceCard
                  invoice={invoice}
                  dispute={disputes.find(d => d.invoiceId === invoice.id && d.status === 'open')}
                  onView={() => setSelectedInvoiceId(invoice.id)}
                  onMarkPaid={() => setShowMarkPaidFor(invoice.id)}
                  onSend={() => setShowSendModal({ invoiceIds: [invoice.id] })}
                  onResendBounced={(newEmail) => handleResendBounced(invoice, newEmail)}
                  onPauseReminders={() => {
                    pauseReminders(invoice.id)
                    toast.success('Reminders paused')
                  }}
                  onResumeReminders={() => {
                    resumeReminders(invoice.id)
                    toast.success('Reminders resumed')
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoice Detail Sheet */}
      <Sheet
        open={!!selectedInvoice && !markPaidInvoice && !showSendModal}
        onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
      >
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedInvoice && (
            <InvoiceDetail
              invoice={selectedInvoice}
              dispute={disputes.find(d => d.invoiceId === selectedInvoice.id)}
              onResolveDispute={resolveDispute}
              onMarkPaid={() => setShowMarkPaidFor(selectedInvoice.id)}
              onSend={() => setShowSendModal({ invoiceIds: [selectedInvoice.id] })}
              onPause={() => {
                pauseReminders(selectedInvoice.id)
                toast.success('Reminders paused')
              }}
              onResume={() => {
                resumeReminders(selectedInvoice.id)
                toast.success('Reminders resumed')
              }}
              onSkipNext={() => {
                skipNextReminder(selectedInvoice.id)
                toast.success('Next reminder skipped')
              }}
              onResendBounced={(newEmail) => handleResendBounced(selectedInvoice, newEmail)}
              onUpdateBillingEmail={(email) => {
                updateInvoiceBillingEmail(selectedInvoice.id, email)
                toast.success('Billing email updated')
              }}
              onUpdateBackupEmail={(email) => {
                updateInvoiceBackupEmail(selectedInvoice.id, email)
                toast.success('Backup email updated')
              }}
            />
          )}
        </SheetContent>
      </Sheet>

  {/* Generate Invoice Modal */}
  <GenerateInvoiceModal
    open={showGenerateModal}
    onClose={() => setShowGenerateModal(false)}
    businesses={businesses}
    rateCards={rateCards}
    onGenerate={generateInvoice}
    onGenerateBusiness={generateBusinessInvoices}
  />

      {/* Mark Paid Modal */}
      {markPaidInvoice && (
        <MarkPaidModal
          open={!!markPaidInvoice}
          invoice={markPaidInvoice}
          onClose={() => setShowMarkPaidFor(null)}
          onConfirm={(details) => {
            markInvoicePaid(markPaidInvoice.id, details)
            toast.success(`Invoice ${markPaidInvoice.invoiceNumber} marked as paid`)
            setShowMarkPaidFor(null)
          }}
        />
      )}

      {/* Send Modal */}
      {showSendModal && sendModalInvoices.length > 0 && (
        <SendInvoicesModal
          open={!!showSendModal}
          invoices={sendModalInvoices}
          dueDays={settings.invoiceDueDays}
          onClose={() => setShowSendModal(null)}
          onSendOne={(inv, email) => handleSendSingle(inv, email)}
          onSendAll={handleSendAll}
        />
      )}
    </div>
  )
}

// ============================================================================
// Auto-send status indicator
// ============================================================================

function AutoSendStatusIndicator({
  autoSend,
  onToggle,
  onSettings,
  onDismiss,
}: {
  autoSend: boolean
  onToggle: () => void
  onSettings: () => void
  onDismiss: () => void
}) {
  if (autoSend) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
          <p className="text-sm text-green-200 truncate">
            <span className="font-medium">Auto-send is ON</span>
            <span className="text-green-300/70"> &mdash; invoices will send automatically on the 1st</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="text-green-300 hover:bg-green-500/20" onClick={onSettings}>
            Settings
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-300/70" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
        <p className="text-sm text-yellow-100 truncate">
          <span className="font-medium">Auto-send is OFF</span>
          <span className="text-yellow-200/80"> &mdash; you must manually send invoices</span>
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-yellow-200 hover:bg-yellow-500/20"
          onClick={onToggle}
        >
          Turn on
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-200/70" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Draft banner
// ============================================================================

function DraftBanner({
  count,
  total,
  onReviewAll,
  onSendAll,
  onChangeAutoSend,
}: {
  count: number
  total: number
  onReviewAll: () => void
  onSendAll: () => void
  onChangeAutoSend: () => void
}) {
  return (
    <Card className="border-yellow-500/50 bg-yellow-500/10">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-yellow-100">
              You have {count} draft invoice{count > 1 ? 's' : ''} waiting to send
            </p>
            <p className="text-sm text-yellow-200/80 mt-0.5">
              Auto-send is OFF &mdash; these {count > 1 ? 'invoices are' : 'invoice is'} sitting as drafts and will not send automatically.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-yellow-200/70">
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> {count} draft{count > 1 ? 's' : ''}
              </span>
              <span>Total: <span className="font-semibold text-yellow-100">{formatCurrency(total)}</span></span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button
            onClick={onSendAll}
            className="bg-[var(--accent-orange,#ff7a1a)] hover:bg-[var(--accent-orange,#ff7a1a)]/90 text-white flex-1 sm:flex-initial"
          >
            <Send className="h-4 w-4 mr-2" />
            Send all drafts now
          </Button>
          <Button variant="outline" onClick={onReviewAll} className="border-yellow-500/40 text-yellow-100 hover:bg-yellow-500/10 flex-1 sm:flex-initial">
            <Eye className="h-4 w-4 mr-2" />
            Review all
          </Button>
          <Button variant="ghost" onClick={onChangeAutoSend} className="text-yellow-200/80 hover:bg-yellow-500/10 flex-1 sm:flex-initial">
            Change auto-send setting
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Invoice card - state-specific layout
// ============================================================================

function InvoiceCard({
  invoice,
  dispute,
  onView,
  onMarkPaid,
  onSend,
  onResendBounced,
  onPauseReminders,
  onResumeReminders,
}: {
  invoice: Invoice
  dispute?: Dispute
  onView: () => void
  onMarkPaid: () => void
  onSend: () => void
  onResendBounced: (newEmail: string) => void
  onPauseReminders: () => void
  onResumeReminders: () => void
}) {
  const meta = buildInvoiceMeta(invoice)
  const status = invoice.status

  return (
    <Card
      className={`bg-card/60 border-border/60 border-l-4 ${statusLeftBorder[status]} transition-colors hover:bg-card/80`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold truncate">{invoice.businessName}</p>
                <Badge variant="outline" className={statusStyles[status]}>
                  {status === 'overdue' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" />}
                  {status === 'escalated' && <Zap className="h-3 w-3 mr-1" />}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Badge>
                {invoice.emailBounced && (
                  <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30 gap-1">
                    <MailWarning className="h-3 w-3" />
                    Bounced
                  </Badge>
                )}
                {invoice.remindersPaused && (
                  <Badge variant="outline" className="bg-gray-500/15 text-gray-300 border-gray-500/30 gap-1">
                    <Pause className="h-3 w-3" />
                    Paused
                  </Badge>
                )}
                {dispute && (
                  <Badge variant="outline" className="bg-yellow-500/15 text-yellow-300 border-yellow-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Disputed
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
                <span>{invoice.invoiceNumber}</span>
                <span aria-hidden>&middot;</span>
                <span>{invoice.locationName}</span>
                <span aria-hidden>&middot;</span>
                <span>
                  {new Date(invoice.periodStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                  &ndash;{' '}
                  {new Date(invoice.periodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0 shrink-0">
            <p className="text-lg font-bold">{formatCurrency(invoice.total)}</p>
            <p className="text-xs text-muted-foreground">
              {status === 'paid' ? `Paid ${humanDate(invoice.paidDate)}` : `Due ${humanDate(invoice.dueDate)}`}
            </p>
          </div>
        </div>

        {/* Meta row */}
        {meta.lines.length > 0 && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
            {meta.lines.map((line, i) => (
              <div key={i} className={`flex items-center gap-1.5 ${line.tone === 'danger' ? 'text-red-300' : line.tone === 'warn' ? 'text-yellow-300' : 'text-muted-foreground'}`}>
                {line.icon}
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {status === 'draft' && !invoice.emailBounced && (
            <Button size="sm" onClick={onSend} className="bg-[var(--accent-orange,#ff7a1a)] hover:bg-[var(--accent-orange,#ff7a1a)]/90 text-white">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send now
            </Button>
          )}
          {status === 'draft' && invoice.emailBounced && (
            <ResendInline onResend={onResendBounced} defaultEmail={invoice.backupBillingEmail || ''} />
          )}
          {(status === 'sent' || status === 'overdue') && !invoice.remindersPaused && (
            <Button size="sm" variant="outline" onClick={onPauseReminders}>
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Pause reminders
            </Button>
          )}
          {(status === 'sent' || status === 'overdue' || status === 'disputed') && invoice.remindersPaused && (
            <Button size="sm" variant="outline" onClick={onResumeReminders}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Resume reminders
            </Button>
          )}
          {status !== 'paid' && status !== 'draft' && (
            <Button size="sm" variant="outline" onClick={onMarkPaid}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Mark paid
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onView} className="ml-auto">
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type MetaLine = { text: string; tone?: 'default' | 'warn' | 'danger'; icon?: React.ReactNode }

function buildInvoiceMeta(invoice: Invoice): { lines: MetaLine[] } {
  const lines: MetaLine[] = []
  const now = new Date()

  switch (invoice.status) {
    case 'draft': {
      if (invoice.emailBounced) {
        lines.push({
          text: `Previous send to ${invoice.billingEmail} bounced`,
          tone: 'danger',
          icon: <MailWarning className="h-3 w-3" />,
        })
      } else {
        lines.push({
          text: `Ready to send to ${invoice.billingEmail}`,
          icon: <Mail className="h-3 w-3" />,
        })
      }
      lines.push({
        text: `Generated ${relativeTime(invoice.createdAt)}`,
        icon: <Clock className="h-3 w-3" />,
      })
      break
    }
    case 'sent': {
      if (invoice.sentAt) {
        const opened = invoice.openedAt ? ` · Opened ${relativeTime(invoice.openedAt)}` : ' · Not opened yet'
        lines.push({
          text: `Sent ${relativeTime(invoice.sentAt)}${opened}`,
          icon: <Send className="h-3 w-3" />,
        })
      }
      const nextScheduled = invoice.emailLog.find(e => e.isScheduled && (e.type === 'reminder_1' || e.type === 'reminder_2'))
      if (nextScheduled && !invoice.remindersPaused) {
        lines.push({
          text: `Next: ${eventLabelShort(nextScheduled.type)} on ${humanDate(nextScheduled.timestamp)}`,
          icon: <Clock className="h-3 w-3" />,
        })
      }
      break
    }
    case 'paid': {
      lines.push({
        text: `Paid ${humanDate(invoice.paidDate)}${invoice.paymentMethod ? ` via ${invoice.paymentMethod.replace('_', ' ')}` : ''}`,
        icon: <CheckCircle2 className="h-3 w-3" />,
      })
      if (invoice.paymentReference) {
        lines.push({ text: `Ref: ${invoice.paymentReference}`, icon: <FileText className="h-3 w-3" /> })
      }
      break
    }
    case 'overdue': {
      const daysLate = invoice.dueDate ? daysBetween(now, new Date(invoice.dueDate)) : 0
      lines.push({
        text: `${daysLate} day${daysLate === 1 ? '' : 's'} overdue`,
        tone: 'danger',
        icon: <AlertTriangle className="h-3 w-3" />,
      })
      const nextSched = invoice.emailLog.find(e => e.isScheduled)
      if (nextSched && !invoice.remindersPaused) {
        lines.push({
          text: `Next: ${eventLabelShort(nextSched.type)} on ${humanDate(nextSched.timestamp)}`,
          tone: 'warn',
          icon: <Clock className="h-3 w-3" />,
        })
      }
      break
    }
    case 'disputed': {
      lines.push({
        text: 'Dispute under review — reminders paused',
        tone: 'warn',
        icon: <AlertTriangle className="h-3 w-3" />,
      })
      break
    }
    case 'escalated': {
      const daysLate = invoice.dueDate ? daysBetween(now, new Date(invoice.dueDate)) : 0
      lines.push({
        text: `Escalated — ${daysLate} days overdue. Automatic reminders stopped.`,
        tone: 'danger',
        icon: <Zap className="h-3 w-3" />,
      })
      lines.push({
        text: 'Admin intervention required',
        tone: 'danger',
        icon: <AlertCircle className="h-3 w-3" />,
      })
      break
    }
  }
  return { lines }
}

function eventLabelShort(type: InvoiceEventType): string {
  switch (type) {
    case 'reminder_1': return 'Reminder 1'
    case 'reminder_2': return 'Reminder 2'
    case 'overdue_notice': return 'Overdue notice'
    case 'escalated': return 'Escalation'
    case 'sent': return 'Sent'
    case 'paid': return 'Paid'
    default: return type.replace('_', ' ')
  }
}

// ============================================================================
// Inline bounce resend
// ============================================================================

function ResendInline({ onResend, defaultEmail }: { onResend: (email: string) => void; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail)
  return (
    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter new email"
        className="h-8 text-xs w-full sm:w-48"
      />
      <Button
        size="sm"
        onClick={() => {
          if (!email.trim()) return toast.error('Enter a new email address')
          onResend(email.trim())
        }}
        className="bg-[var(--accent-orange,#ff7a1a)] hover:bg-[var(--accent-orange,#ff7a1a)]/90 text-white"
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1" />
        Resend
      </Button>
    </div>
  )
}

// ============================================================================
// Invoice detail (sheet)
// ============================================================================

function InvoiceDetail({
  invoice,
  dispute,
  onResolveDispute,
  onMarkPaid,
  onSend,
  onPause,
  onResume,
  onSkipNext,
  onResendBounced,
  onUpdateBillingEmail,
  onUpdateBackupEmail,
}: {
  invoice: Invoice
  dispute?: Dispute
  onResolveDispute: (disputeId: string, action: 'accept' | 'reject', adminNote: string, creditAmount?: number) => void
  onMarkPaid: () => void
  onSend: () => void
  onPause: () => void
  onResume: () => void
  onSkipNext: () => void
  onResendBounced: (newEmail: string) => void
  onUpdateBillingEmail: (email: string) => void
  onUpdateBackupEmail: (email: string) => void
}) {
  const [disputeResponse, setDisputeResponse] = useState('')
  const [editingEmail, setEditingEmail] = useState(false)
  const [editingBackup, setEditingBackup] = useState(false)
  const [billingEmailDraft, setBillingEmailDraft] = useState(invoice.billingEmail)
  const [backupEmailDraft, setBackupEmailDraft] = useState(invoice.backupBillingEmail || '')

  // Compose and sort timeline: past (non-scheduled) asc + future scheduled
  const timeline = useMemo(() => {
    const past = invoice.emailLog.filter(e => !e.isScheduled).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const future = invoice.emailLog.filter(e => e.isScheduled).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return { past, future }
  }, [invoice.emailLog])

  const hasUpcomingReminder = timeline.future.some(e => e.type === 'reminder_1' || e.type === 'reminder_2' || e.type === 'overdue_notice')

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Invoice {invoice.invoiceNumber}</SheetTitle>
      </SheetHeader>

      {/* Recipient emails */}
      <Card className="bg-muted/30 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Recipient
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Billing email</Label>
            {editingEmail ? (
              <div className="flex items-center gap-2 mt-1">
                <Input value={billingEmailDraft} onChange={(e) => setBillingEmailDraft(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" onClick={() => { onUpdateBillingEmail(billingEmailDraft.trim()); setEditingEmail(false) }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setBillingEmailDraft(invoice.billingEmail); setEditingEmail(false) }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm">{invoice.billingEmail || <span className="text-muted-foreground italic">not set</span>}</p>
                {invoice.emailBounced && <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30 text-[10px]">Bounced</Badge>}
                <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => setEditingEmail(true)}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Backup email (used if primary bounces)</Label>
            {editingBackup ? (
              <div className="flex items-center gap-2 mt-1">
                <Input value={backupEmailDraft} onChange={(e) => setBackupEmailDraft(e.target.value)} placeholder="backup@company.com" className="h-8 text-sm" />
                <Button size="sm" onClick={() => { onUpdateBackupEmail(backupEmailDraft.trim()); setEditingBackup(false) }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setBackupEmailDraft(invoice.backupBillingEmail || ''); setEditingBackup(false) }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm">{invoice.backupBillingEmail || <span className="text-muted-foreground italic">none</span>}</p>
                <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => setEditingBackup(true)}>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Preview */}
      <Card className="bg-white text-gray-900">
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">LV Courier Inc.</h3>
              <p className="text-sm text-gray-600">Calgary, AB</p>
              <p className="text-sm text-gray-600">(403) 555-0100</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Invoice #</p>
              <p className="font-bold">{invoice.invoiceNumber}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-1">Bill To:</p>
            <p className="font-medium">{invoice.businessName}</p>
            <p className="text-sm text-gray-600">{invoice.locationName}</p>
            <p className="text-sm text-gray-600">{invoice.locationAddress}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-4">
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-sm font-medium">{new Date(invoice.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payment Due</p>
              <p className="text-sm font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Amount Due</p>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(invoice.total)}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600 font-medium">Description</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Qty</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Rate</th>
                  <th className="text-right py-2 text-gray-600 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map(line => (
                  <tr key={line.id} className="border-b border-gray-100">
                    <td className="py-2">{line.description}</td>
                    <td className="py-2 text-right">{line.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(line.rate)}</td>
                    <td className="py-2 text-right">{formatCurrency(line.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="py-2 text-right font-medium">Subtotal</td>
                  <td className="py-2 text-right">{formatCurrency(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 text-right font-medium">GST 5%</td>
                  <td className="py-2 text-right">{formatCurrency(invoice.gstAmount)}</td>
                </tr>
                <tr className="border-t border-gray-300">
                  <td colSpan={3} className="py-2 text-right font-bold">Amount Due (CAD)</td>
                  <td className="py-2 text-right font-bold">{formatCurrency(invoice.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-gray-200 pt-4 text-sm">
            <p className="font-medium text-gray-900 mb-1">Payment Instructions:</p>
            <p className="text-gray-600">E-transfer to: lvcourieralberta@gmail.com</p>
            <p className="text-gray-600">Reference: {invoice.invoiceNumber}</p>
          </div>
        </CardContent>
      </Card>

      {/* Dispute Section */}
      {dispute && dispute.status === 'open' && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader>
            <CardTitle className="text-base text-yellow-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Open Dispute &mdash; {dispute.lineItemDescription}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Business claim:</p>
              <p className="text-sm">{dispute.claim}</p>
            </div>
            <div className="space-y-2">
              <Label>Admin response</Label>
              <Textarea
                value={disputeResponse}
                onChange={(e) => setDisputeResponse(e.target.value)}
                placeholder="Enter your response..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-green-500/50 text-green-400 hover:bg-green-500/10"
                onClick={() => {
                  const creditAmount = invoice.lines.find(l => l.id === dispute.lineItemId)?.total || 0
                  onResolveDispute(dispute.id, 'accept', disputeResponse, creditAmount)
                  toast.success('Dispute accepted — credit will appear on next invoice')
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Accept &mdash; Adjust Invoice
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  onResolveDispute(dispute.id, 'reject', disputeResponse)
                  toast.success('Dispute rejected — business notified')
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminder controls */}
      {(invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'disputed') && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Reminder controls</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!invoice.remindersPaused ? (
              <Button variant="outline" size="sm" onClick={onPause}>
                <Pause className="h-3.5 w-3.5 mr-1.5" />
                Pause reminders
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onResume}>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Resume reminders
              </Button>
            )}
            {hasUpcomingReminder && !invoice.remindersPaused && (
              <Button variant="outline" size="sm" onClick={onSkipNext}>
                <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                Skip next reminder
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Activity timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-3">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            {timeline.past.map(event => (
              <TimelineEventItem
                key={event.id}
                event={event}
                past
                onResendBounced={onResendBounced}
                defaultEmail={invoice.backupBillingEmail || ''}
              />
            ))}
            {timeline.future.length > 0 && (
              <>
                <div className="relative pt-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Scheduled</p>
                </div>
                {timeline.future.map(event => (
                  <TimelineEventItem key={event.id} event={event} past={false} />
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4">
        {invoice.status === 'draft' && !invoice.emailBounced && (
          <Button onClick={onSend} className="flex-1 bg-[var(--accent-orange,#ff7a1a)] hover:bg-[var(--accent-orange,#ff7a1a)]/90 text-white">
            <Send className="h-4 w-4 mr-2" />
            Send now
          </Button>
        )}
        {invoice.status !== 'paid' && invoice.status !== 'draft' && (
          <Button variant="outline" className="flex-1" onClick={onMarkPaid}>
            <Check className="h-4 w-4 mr-2" />
            Mark paid
          </Button>
        )}
        <Button variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
    </div>
  )
}

function TimelineEventItem({
  event,
  past,
  onResendBounced,
  defaultEmail,
}: {
  event: InvoiceEmailEvent
  past: boolean
  onResendBounced?: (email: string) => void
  defaultEmail?: string
}) {
  const isBounced = event.type === 'bounced'
  return (
    <div className="relative flex items-start gap-3">
      <div className="absolute -left-6 mt-1">
        <EmailEventIcon type={event.type} scheduled={!past} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isBounced ? 'text-red-400' : past ? 'text-foreground' : 'text-muted-foreground italic'}`}>
          {getEventLabel(event)}
          {!past && <span className="ml-1 text-[10px] uppercase tracking-wide">(scheduled)</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {past ? relativeTime(event.timestamp) : humanDate(event.timestamp)}
          {event.note && <span className="ml-2">&middot; {event.note}</span>}
        </p>
        {isBounced && onResendBounced && (
          <div className="mt-2">
            <ResendInline onResend={onResendBounced} defaultEmail={defaultEmail || ''} />
          </div>
        )}
      </div>
    </div>
  )
}

function EmailEventIcon({ type, scheduled }: { type: InvoiceEventType; scheduled?: boolean }) {
  const opacity = scheduled ? 'opacity-50' : ''
  switch (type) {
    case 'generated':
      return <FileText className={`h-4 w-4 text-gray-400 mt-0.5 ${opacity}`} />
    case 'sent':
    case 'resent':
      return <Send className={`h-4 w-4 text-blue-400 mt-0.5 ${opacity}`} />
    case 'opened':
      return <Eye className={`h-4 w-4 text-green-400 mt-0.5 ${opacity}`} />
    case 'reminder_1':
    case 'reminder_2':
    case 'reminder':
    case 'due_reminder':
      return <Mail className={`h-4 w-4 text-blue-400 mt-0.5 ${opacity}`} />
    case 'overdue_notice':
    case 'overdue':
      return <AlertTriangle className={`h-4 w-4 text-yellow-500 mt-0.5 ${opacity}`} />
    case 'escalated':
      return <Zap className={`h-4 w-4 text-red-500 mt-0.5 ${opacity}`} />
    case 'bounced':
      return <MailWarning className={`h-4 w-4 text-red-500 mt-0.5 ${opacity}`} />
    case 'disputed':
      return <AlertTriangle className={`h-4 w-4 text-yellow-400 mt-0.5 ${opacity}`} />
    case 'dispute_resolved':
      return <CheckCircle2 className={`h-4 w-4 text-green-400 mt-0.5 ${opacity}`} />
    case 'paid':
      return <CheckCircle2 className={`h-4 w-4 text-green-500 mt-0.5 ${opacity}`} />
    case 'sms_sent':
      return <Send className={`h-4 w-4 text-blue-400 mt-0.5 ${opacity}`} />
    case 'skipped':
      return <SkipForward className={`h-4 w-4 text-muted-foreground mt-0.5 ${opacity}`} />
    case 'reminders_paused':
      return <Pause className={`h-4 w-4 text-muted-foreground mt-0.5 ${opacity}`} />
    case 'reminders_resumed':
      return <Play className={`h-4 w-4 text-muted-foreground mt-0.5 ${opacity}`} />
    default:
      return <Mail className={`h-4 w-4 text-muted-foreground mt-0.5 ${opacity}`} />
  }
}

function getEventLabel(event: InvoiceEmailEvent): string {
  switch (event.type) {
    case 'generated': return 'Invoice generated as draft'
    case 'sent': return `Sent to ${event.email || 'billing email'}`
    case 'resent': return `Resent to ${event.email || 'billing email'}`
    case 'opened': return 'Email opened by recipient'
    case 'reminder': return event.note || 'Payment reminder sent'
    case 'due_reminder': return event.note || 'Due-date reminder sent'
    case 'reminder_1': return `Reminder 1 sent${event.email ? ` to ${event.email}` : ''}`
    case 'reminder_2': return `Reminder 2 (due date) sent${event.email ? ` to ${event.email}` : ''}`
    case 'overdue_notice': return `Overdue notice sent${event.email ? ` to ${event.email}` : ''}`
    case 'overdue': return 'Overdue notice sent'
    case 'escalated': return 'Escalated — admin notified'
    case 'bounced': return `Email bounced${event.email ? ` (${event.email})` : ''}`
    case 'disputed': return event.note || 'Dispute raised'
    case 'dispute_resolved': return event.note || 'Dispute resolved'
    case 'paid': return event.note || 'Marked as paid'
    case 'sms_sent': return `SMS sent${event.phone ? ` to ${event.phone}` : ''}`
    case 'skipped': return event.note || 'Scheduled reminder skipped'
    case 'reminders_paused': return event.note || 'Reminders paused'
    case 'reminders_resumed': return event.note || 'Reminders resumed'
    default: return event.type
  }
}

// ============================================================================
// Generate Invoice Modal
// ============================================================================

type InvoiceFormat = 'separate' | 'combined' | 'combined_breakdown'

function GenerateInvoiceModal({
  open,
  onClose,
  businesses,
  rateCards: _rateCards,
  onGenerate,
  onGenerateBusiness,
}: {
  open: boolean
  onClose: () => void
  businesses: any[]
  rateCards: any[]
  onGenerate: (businessId: string, locationId: string, periodStart: string, periodEnd: string) => Invoice | null
  onGenerateBusiness?: (businessId: string, periodStart: string, periodEnd: string, format?: InvoiceFormat) => Invoice[]
}) {
  const [selectedBusiness, setSelectedBusiness] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [generateMode, setGenerateMode] = useState<'single' | 'all'>('single')
  const [invoiceFormat, setInvoiceFormat] = useState<InvoiceFormat>('separate')
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    date.setDate(1)
    return date.toISOString().split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(() => {
    const date = new Date()
    date.setDate(0)
    return date.toISOString().split('T')[0]
  })

  const selectedBusinessData = businesses.find(b => b.id === selectedBusiness)
  const locations = selectedBusinessData?.locations || []
  const hasMultipleLocations = locations.length > 1

  const handleGenerate = () => {
    if (!selectedBusiness) {
      toast.error('Please select a business')
      return
    }
    
    if (generateMode === 'all' && hasMultipleLocations && onGenerateBusiness) {
      // Generate for all locations with the selected format
      const invoices = onGenerateBusiness(selectedBusiness, periodStart, periodEnd, invoiceFormat)
      if (invoices.length > 0) {
        if (invoiceFormat === 'separate') {
          toast.success(`Generated ${invoices.length} invoices (one per location)`)
        } else {
          toast.success(`Generated combined invoice for ${locations.length} locations`)
        }
        onClose()
      } else {
        toast.error('No invoices generated — check deliveries exist for this period')
      }
    } else {
      // Single location mode
      if (!selectedLocation) {
        toast.error('Please select a location')
        return
      }
      const invoice = onGenerate(selectedBusiness, selectedLocation, periodStart, periodEnd)
      if (invoice) {
        toast.success(`Invoice ${invoice.invoiceNumber} generated`)
        onClose()
      } else {
        toast.error('Failed to generate invoice — check rate card exists')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>
            Create invoices for business deliveries during the selected period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Business</Label>
            <Select value={selectedBusiness} onValueChange={(v) => { setSelectedBusiness(v); setSelectedLocation(''); setGenerateMode('single') }}>
              <SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger>
              <SelectContent>
                {businesses.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    <div className="flex items-center gap-2">
                      {b.name}
                      {b.locations?.length > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          {b.locations.length} locations
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Multi-location options */}
          {selectedBusiness && hasMultipleLocations && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="generate-all"
                  checked={generateMode === 'all'}
                  onCheckedChange={(checked) => setGenerateMode(checked ? 'all' : 'single')}
                />
                <Label htmlFor="generate-all" className="text-sm font-medium cursor-pointer">
                  Generate for all {locations.length} locations
                </Label>
              </div>
              
              {generateMode === 'all' && (
                <div className="space-y-2 ml-6">
                  <Label className="text-xs text-muted-foreground">Invoice Format</Label>
                  <Select value={invoiceFormat} onValueChange={(v) => setInvoiceFormat(v as InvoiceFormat)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="separate">
                        <div className="flex flex-col">
                          <span>Separate invoices</span>
                          <span className="text-xs text-muted-foreground">One invoice per location</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="combined">
                        <div className="flex flex-col">
                          <span>Combined invoice</span>
                          <span className="text-xs text-muted-foreground">All locations merged into one</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="combined_breakdown">
                        <div className="flex flex-col">
                          <span>Combined with breakdown</span>
                          <span className="text-xs text-muted-foreground">One invoice showing each location separately</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          
          {/* Single location selector */}
          {selectedBusiness && generateMode === 'single' && (
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Period End</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate}>
            <FileText className="h-4 w-4 mr-2" />
            {generateMode === 'all' && hasMultipleLocations
              ? invoiceFormat === 'separate' 
                ? `Generate ${locations.length} Invoices`
                : 'Generate Combined Invoice'
              : 'Generate Invoice'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Mark Paid Modal (enhanced)
// ============================================================================

function MarkPaidModal({
  open,
  invoice,
  onClose,
  onConfirm,
}: {
  open: boolean
  invoice: Invoice
  onClose: () => void
  onConfirm: (details: PaymentDetails) => void
}) {
  const [method, setMethod] = useState<PaymentDetails['method']>('e_transfer')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState(invoice.total)

  const scheduledCount = invoice.emailLog.filter(e => e.isScheduled).length

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark invoice as paid</DialogTitle>
          <DialogDescription>This will cancel all scheduled reminders for this invoice.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">Invoice</p>
            <p className="font-medium">{invoice.invoiceNumber} &middot; {invoice.businessName}</p>
            <p className="text-lg font-bold mt-1">{formatCurrency(invoice.total)}</p>
          </div>

          {scheduledCount > 0 && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {scheduledCount} scheduled reminder{scheduledCount > 1 ? 's' : ''} will be cancelled when you mark this paid.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentDetails['method'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="e_transfer">E-transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Reference / note</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="E-transfer reference, cheque number, etc." />
          </div>

          <div className="space-y-2">
            <Label>Amount received</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            {amount !== invoice.total && (
              <p className="text-xs text-yellow-400">
                {amount > invoice.total ? 'Overpaid' : 'Partial payment'} of {formatCurrency(Math.abs(amount - invoice.total))}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm({ method, date, reference, amountReceived: amount })}>
            <Check className="h-4 w-4 mr-2" />
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Send Invoices Modal (single or multiple)
// ============================================================================

function SendInvoicesModal({
  open,
  invoices,
  dueDays,
  onClose,
  onSendOne,
  onSendAll,
}: {
  open: boolean
  invoices: Invoice[]
  dueDays: number
  onClose: () => void
  onSendOne: (invoice: Invoice, backupEmail?: string) => void
  onSendAll: () => void
}) {
  const isSingle = invoices.length === 1
  const onlyInvoice = invoices[0]
  const [backupEmail, setBackupEmail] = useState(onlyInvoice?.backupBillingEmail || '')
  const [skipIds, setSkipIds] = useState<Set<string>>(new Set())

  const needsBackup = isSingle && onlyInvoice.emailBounced

  const sendable = invoices.filter(i => !skipIds.has(i.id))
  const sendableTotal = sendable.reduce((s, i) => s + i.total, 0)

  const newDue = new Date()
  newDue.setDate(newDue.getDate() + dueDays)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isSingle ? `Send invoice ${onlyInvoice.invoiceNumber}` : `Send ${invoices.length} draft invoices`}
          </DialogTitle>
          <DialogDescription>
            {isSingle
              ? `This invoice will be sent immediately. Due date will be ${newDue.toLocaleDateString()}.`
              : `All selected invoices will be sent immediately with a due date of ${newDue.toLocaleDateString()}.`}
          </DialogDescription>
        </DialogHeader>

        {isSingle ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg space-y-1">
              <p className="text-sm text-muted-foreground">Invoice</p>
              <p className="font-medium">{onlyInvoice.invoiceNumber} &middot; {onlyInvoice.businessName}</p>
              <p className="text-lg font-bold">{formatCurrency(onlyInvoice.total)}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Sending to</Label>
              <p className="text-sm mt-0.5">{onlyInvoice.billingEmail}</p>
              {onlyInvoice.emailBounced && (
                <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                  Previous send attempt bounced. Provide a new email address to send to below.
                </div>
              )}
            </div>

            {needsBackup && (
              <div className="space-y-2">
                <Label>New email address</Label>
                <Input
                  value={backupEmail}
                  onChange={(e) => setBackupEmail(e.target.value)}
                  placeholder="new@company.com"
                />
              </div>
            )}

            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Due date: {newDue.toLocaleDateString()}</p>
              <p className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Reminder schedule will be activated on send</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Review invoices below. Uncheck any you want to skip.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {invoices.map(inv => {
                const checked = !skipIds.has(inv.id)
                const blocked = !inv.billingEmail || inv.emailBounced
                return (
                  <div key={inv.id} className={`flex items-start gap-3 p-3 rounded-md border ${blocked ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/20'}`}>
                    <Checkbox
                      checked={checked && !blocked}
                      disabled={blocked}
                      onCheckedChange={(c) => {
                        setSkipIds(prev => {
                          const next = new Set(prev)
                          if (c) next.delete(inv.id); else next.add(inv.id)
                          return next
                        })
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground truncate">{inv.businessName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        To: {inv.billingEmail || <span className="text-red-400">no email</span>}
                      </p>
                      {inv.emailBounced && (
                        <p className="text-xs text-red-400 mt-0.5">Previous send bounced &mdash; will be skipped</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold shrink-0">{formatCurrency(inv.total)}</p>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between text-sm px-1 pt-2 border-t border-border">
              <span className="text-muted-foreground">{sendable.length} will be sent</span>
              <span className="font-semibold">{formatCurrency(sendableTotal)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (isSingle) {
                onSendOne(onlyInvoice, needsBackup ? backupEmail : undefined)
              } else {
                onSendAll()
              }
            }}
            className="bg-[var(--accent-orange,#ff7a1a)] hover:bg-[var(--accent-orange,#ff7a1a)]/90 text-white"
            disabled={needsBackup && !backupEmail.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSingle ? 'Send now' : `Send ${sendable.length} invoices`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Unmatched payment row
// ============================================================================

function UnmatchedPaymentRow({
  payment,
  invoices,
  onMatch,
}: {
  payment: any
  invoices: Invoice[]
  onMatch: (invoiceId: string) => void
}) {
  const [selectedInvoice, setSelectedInvoice] = useState('')

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-yellow-500/5 rounded-lg">
      <div className="flex-1">
        <p className="font-medium">{formatCurrency(payment.amount)}</p>
        <p className="text-sm text-muted-foreground">
          {new Date(payment.dateReceived).toLocaleDateString()} &middot; {payment.senderReference}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Match to invoice" />
          </SelectTrigger>
          <SelectContent>
            {invoices.map(inv => (
              <SelectItem key={inv.id} value={inv.id}>
                {inv.invoiceNumber} &middot; {formatCurrency(inv.total)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!selectedInvoice} onClick={() => onMatch(selectedInvoice)}>
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
