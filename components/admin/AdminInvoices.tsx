'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import type { Invoice, InvoiceStatus, Dispute, PaymentDetails } from '@/lib/types'
import { formatCurrency } from '@/lib/billing'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Mail,
  MailWarning,
  Plus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

const statusStyles: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  disputed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  escalated: 'bg-red-500/10 text-red-500 border-red-500/20 font-bold',
}

export function AdminInvoices() {
  const { invoices, businesses, rateCards, generateInvoice, markInvoicePaid, disputes, resolveDispute, unmatchedPayments, matchPayment } = useApp()
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false)
  const [showUnmatchedPayments, setShowUnmatchedPayments] = useState(true)

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true
    return inv.status === filter
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Get unmatched payments that haven't been matched
  const pendingPayments = unmatchedPayments.filter(p => !p.matchedInvoiceId)

  return (
    <div className="space-y-6">
      {/* Unmatched Payments Banner */}
      {pendingPayments.length > 0 && showUnmatchedPayments && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-base text-yellow-200">
                  {pendingPayments.length} unmatched payment{pendingPayments.length > 1 ? 's' : ''} - action required
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
          <p className="text-sm text-muted-foreground">{filteredInvoices.length} invoices</p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Generate Invoice
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as InvoiceStatus | 'all')}>
        <TabsList className="bg-muted/30">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="disputed">Disputed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Invoice List */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No invoices found
              </div>
            ) : (
              filteredInvoices.map(invoice => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  dispute={disputes.find(d => d.invoiceId === invoice.id && d.status === 'open')}
                  onView={() => setSelectedInvoice(invoice)}
                  onMarkPaid={() => {
                    setSelectedInvoice(invoice)
                    setShowMarkPaidModal(true)
                  }}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!selectedInvoice && !showMarkPaidModal} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedInvoice && (
            <InvoiceDetail
              invoice={selectedInvoice}
              dispute={disputes.find(d => d.invoiceId === selectedInvoice.id)}
              onResolveDispute={resolveDispute}
              onMarkPaid={() => setShowMarkPaidModal(true)}
              onClose={() => setSelectedInvoice(null)}
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
      />

      {/* Mark Paid Modal */}
      {selectedInvoice && (
        <MarkPaidModal
          open={showMarkPaidModal}
          invoice={selectedInvoice}
          onClose={() => {
            setShowMarkPaidModal(false)
            setSelectedInvoice(null)
          }}
          onConfirm={(details) => {
            markInvoicePaid(selectedInvoice.id, details)
            toast.success(`Invoice ${selectedInvoice.invoiceNumber} marked as paid`)
            setShowMarkPaidModal(false)
            setSelectedInvoice(null)
          }}
        />
      )}
    </div>
  )
}

// Invoice Row Component
function InvoiceRow({
  invoice,
  dispute,
  onView,
  onMarkPaid,
}: {
  invoice: Invoice
  dispute?: Dispute
  onView: () => void
  onMarkPaid: () => void
}) {
  const isOverdue = invoice.status === 'overdue'
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{invoice.businessName}</p>
            <Badge variant="outline" className={statusStyles[invoice.status]}>
              {isOverdue && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />}
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Badge>
            {dispute && dispute.status === 'open' && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Disputed
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
            <span>{invoice.invoiceNumber}</span>
            <span>{invoice.locationName}</span>
            <span>{new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(invoice.total)}</p>
          <p className="text-xs text-muted-foreground">
            Due: {new Date(invoice.dueDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
          {invoice.status !== 'paid' && (
            <Button variant="ghost" size="sm" onClick={onMarkPaid}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Invoice Detail Component
function InvoiceDetail({
  invoice,
  dispute,
  onResolveDispute,
  onMarkPaid,
  onClose,
}: {
  invoice: Invoice
  dispute?: Dispute
  onResolveDispute: (disputeId: string, action: 'accept' | 'reject', adminNote: string, creditAmount?: number) => void
  onMarkPaid: () => void
  onClose: () => void
}) {
  const [disputeResponse, setDisputeResponse] = useState('')

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Invoice {invoice.invoiceNumber}</SheetTitle>
      </SheetHeader>

      {/* Invoice Preview */}
      <Card className="bg-white text-gray-900">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
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

          {/* Bill To */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-1">Bill To:</p>
            <p className="font-medium">{invoice.businessName}</p>
            <p className="text-sm text-gray-600">{invoice.locationName}</p>
            <p className="text-sm text-gray-600">{invoice.locationAddress}</p>
          </div>

          {/* Invoice Info */}
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

          {/* Line Items */}
          <div className="border-t border-gray-200 pt-4">
            <table className="w-full text-sm">
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

          {/* Payment Instructions */}
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
              Open Dispute - {dispute.lineItemDescription}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Business claim:</p>
              <p className="text-sm">{dispute.claim}</p>
            </div>
            {dispute.photoUrl && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Attached photo:</p>
                <div className="h-32 w-32 rounded-lg bg-muted/50" />
              </div>
            )}
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
                  toast.success('Dispute accepted - credit will appear on next invoice')
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Accept - Adjust Invoice
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  onResolveDispute(dispute.id, 'reject', disputeResponse)
                  toast.success('Dispute rejected - business notified')
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Log Timeline */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-4">
            {/* Vertical line */}
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            
            {invoice.emailLog.map((event, index) => {
              const isBounced = event.type === 'bounced'
              const eventLabel = getEventLabel(event)
              
              return (
                <div key={event.id} className="relative flex items-start gap-3">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 mt-1">
                    <EmailEventIcon type={event.type} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isBounced ? 'text-red-400' : 'text-foreground'}`}>
                      {eventLabel}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatEmailTimestamp(event.timestamp)}
                    </p>
                    
                    {/* Bounced email action */}
                    {isBounced && (
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          placeholder="Enter new email address"
                          className="h-8 text-xs max-w-[200px]"
                        />
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resend
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {invoice.status !== 'paid' && (
          <>
            <Button variant="outline" className="flex-1" onClick={onMarkPaid}>
              <Check className="h-4 w-4 mr-2" />
              Mark Paid
            </Button>
            <Button variant="outline" className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Resend
            </Button>
          </>
        )}
        <Button variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
    </div>
  )
}

function EmailEventIcon({ type }: { type: string }) {
  switch (type) {
    case 'generated':
    case 'sent':
    case 'opened':
      return <Check className="h-4 w-4 text-green-500 mt-0.5" />
    case 'reminder':
    case 'due_reminder':
      return <Mail className="h-4 w-4 text-blue-400 mt-0.5" />
    case 'overdue':
      return <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
    case 'escalated':
      return <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
    case 'bounced':
      return <MailWarning className="h-4 w-4 text-red-500 mt-0.5" />
    default:
      return <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
  }
}

function getEventLabel(event: { type: string; email?: string; note?: string }): string {
  switch (event.type) {
    case 'generated':
      return 'Invoice generated'
    case 'sent':
      return `Sent to ${event.email || 'billing email'}`
    case 'opened':
      return 'Email opened by recipient'
    case 'reminder':
      return event.note || 'Payment reminder sent'
    case 'due_reminder':
      return event.note || 'Due date reminder sent'
    case 'overdue':
      return 'Overdue notice sent'
    case 'escalated':
      return 'ESCALATED - Admin notified'
    case 'bounced':
      return 'Email bounced - delivery failed'
    case 'resent':
      return 'Email resent'
    default:
      return event.type
  }
}

function formatEmailTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 60) {
    return `${diffMins} min ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
}

// Generate Invoice Modal
function GenerateInvoiceModal({
  open,
  onClose,
  businesses,
  rateCards,
  onGenerate,
}: {
  open: boolean
  onClose: () => void
  businesses: any[]
  rateCards: any[]
  onGenerate: (businessId: string, locationId: string, periodStart: string, periodEnd: string) => any
}) {
  const [selectedBusiness, setSelectedBusiness] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    date.setDate(1)
    return date.toISOString().split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(() => {
    const date = new Date()
    date.setDate(0) // Last day of previous month
    return date.toISOString().split('T')[0]
  })

  const selectedBusinessData = businesses.find(b => b.id === selectedBusiness)
  const locations = selectedBusinessData?.locations || []

  const handleGenerate = () => {
    if (!selectedBusiness || !selectedLocation) {
      toast.error('Please select a business and location')
      return
    }
    const invoice = onGenerate(selectedBusiness, selectedLocation, periodStart, periodEnd)
    if (invoice) {
      toast.success(`Invoice ${invoice.invoiceNumber} generated`)
      onClose()
    } else {
      toast.error('Failed to generate invoice - check rate card exists')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Business</Label>
            <Select value={selectedBusiness} onValueChange={(v) => {
              setSelectedBusiness(v)
              setSelectedLocation('')
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBusiness && (
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Period End</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate}>
            <FileText className="h-4 w-4 mr-2" />
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Mark Paid Modal
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">Invoice</p>
            <p className="font-medium">{invoice.invoiceNumber} - {invoice.businessName}</p>
            <p className="text-lg font-bold mt-1">{formatCurrency(invoice.total)}</p>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentDetails['method'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="e_transfer">E-transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Reference / Note</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="E-transfer reference, cheque number, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Amount Received</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm({ method, date, reference, amountReceived: amount })}>
            <Check className="h-4 w-4 mr-2" />
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Unmatched Payment Row
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
          {new Date(payment.dateReceived).toLocaleDateString()} - {payment.senderReference}
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
                {inv.invoiceNumber} - {formatCurrency(inv.total)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!selectedInvoice}
          onClick={() => onMatch(selectedInvoice)}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
