'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import type { Invoice, InvoiceLine } from '@/lib/types'
import { formatCurrency, getDeliveryTypeLabel, getRateForType } from '@/lib/billing'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  FileText,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  disputed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  escalated: 'bg-red-500/10 text-red-500 border-red-500/20 font-bold',
}

export function BusinessInvoices() {
  const { currentUser, activeLocationId, invoices, deliveries, rateCards, disputeLineItem } = useApp()
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeLineId, setDisputeLineId] = useState<string | null>(null)

  // Get invoices for this business/location
  const businessInvoices = (invoices || []).filter(inv => 
    inv.businessId === currentUser?.businessId &&
    (activeLocationId ? inv.locationId === activeLocationId : true)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Get current month's running total
  const currentMonth = new Date()
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const monthDeliveries = (deliveries || []).filter(d =>
    d.businessId === currentUser?.businessId &&
    (activeLocationId ? d.locationId === activeLocationId : true) &&
    d.status === 'delivered' &&
    d.deliveredAt &&
    new Date(d.deliveredAt) >= monthStart
  )

  const rateCard = rateCards.find(rc => rc.locationId === activeLocationId)
  
  // Calculate running total
  const runningTotal = monthDeliveries.reduce((sum, d) => {
    return sum + (d.calculatedRate || rateCard?.regular || 9)
  }, 0)
  const runningGst = rateCard?.applyGst ? runningTotal * 0.05 : 0
  const runningTotalWithGst = runningTotal + runningGst

  const handleStartDispute = (lineId: string) => {
    setDisputeLineId(lineId)
    setShowDisputeModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Current Month Running Total */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} - Running Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold">{formatCurrency(runningTotalWithGst)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {monthDeliveries.length} deliveries this month
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowBreakdown(true)}>
              View Breakdown
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Past Invoices */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Past Invoices</CardTitle>
          <CardDescription>View and download your invoices</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {businessInvoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No invoices yet
              </div>
            ) : (
              businessInvoices.map(invoice => (
                <button
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <Badge variant="outline" className={statusStyles[invoice.status]}>
                          {invoice.status === 'overdue' && (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />
                          )}
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.status === 'paid' 
                          ? `Paid ${new Date(invoice.paidDate!).toLocaleDateString()}`
                          : `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                        }
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedInvoice && (
            <InvoiceDetailView
              invoice={selectedInvoice}
              onDispute={handleStartDispute}
              onClose={() => setSelectedInvoice(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Monthly Breakdown Sheet */}
      <Sheet open={showBreakdown} onOpenChange={setShowBreakdown}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} Breakdown
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <MonthlyBreakdown
              deliveries={monthDeliveries}
              rateCard={rateCard}
            />
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Final invoice will be generated on {new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1).toLocaleDateString()}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dispute Modal */}
      {selectedInvoice && disputeLineId && (
        <DisputeModal
          open={showDisputeModal}
          invoice={selectedInvoice}
          lineItemId={disputeLineId}
          onClose={() => {
            setShowDisputeModal(false)
            setDisputeLineId(null)
          }}
          onSubmit={(claim, photoUrl) => {
            disputeLineItem(selectedInvoice.id, disputeLineId, claim, photoUrl)
            toast.success('Dispute submitted. Reminders paused. We\'ll respond within 1-2 business days.')
            setShowDisputeModal(false)
            setDisputeLineId(null)
            setSelectedInvoice(null)
          }}
        />
      )}
    </div>
  )
}

// Invoice Detail View
function InvoiceDetailView({
  invoice,
  onDispute,
  onClose,
}: {
  invoice: Invoice
  onDispute: (lineId: string) => void
  onClose: () => void
}) {
  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Invoice {invoice.invoiceNumber}</SheetTitle>
      </SheetHeader>

      {/* Status Banner */}
      {invoice.status === 'overdue' && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-400">Payment Overdue</p>
                <p className="text-sm text-red-400/80">
                  This invoice was due on {new Date(invoice.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Summary */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Period</span>
            <span>{new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Due Date</span>
            <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline" className={statusStyles[invoice.status]}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <div className="space-y-2">
        <h4 className="font-medium">Charges</h4>
        <div className="space-y-2">
          {invoice.lines.map(line => (
            <div key={line.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium">{line.description}</p>
                <p className="text-sm text-muted-foreground">
                  {line.quantity} x {formatCurrency(line.rate)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(line.total)}</p>
                {invoice.status !== 'paid' && (
                  <button
                    onClick={() => onDispute(line.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    Dispute
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="space-y-2 pt-4 border-t border-border/50">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GST 5%</span>
          <span>{formatCurrency(invoice.gstAmount)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border/50">
          <span>Total</span>
          <span>{formatCurrency(invoice.total)}</span>
        </div>
      </div>

      {/* Payment Info (if unpaid) */}
      {invoice.status !== 'paid' && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="font-medium mb-2">Payment Instructions</p>
            <p className="text-sm text-muted-foreground">E-transfer to: lvcourieralberta@gmail.com</p>
            <p className="text-sm text-muted-foreground">Reference: {invoice.invoiceNumber}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
    </div>
  )
}

// Monthly Breakdown Component
function MonthlyBreakdown({
  deliveries,
  rateCard,
}: {
  deliveries: any[]
  rateCard: any
}) {
  // Group deliveries by type
  const breakdown: Record<string, { count: number; rate: number; total: number }> = {}

  deliveries.forEach(d => {
    const bigCount = d.manifest?.filter((i: any) => i.type === 'big_package').reduce((sum: number, i: any) => sum + (i.confirmedQty ?? i.postedQty), 0) || 0
    const isRush = d.isUrgent
    const isOOT = d.isOutOfTown

    let type = 'regular'
    if (isRush && isOOT) type = 'rush_out_of_town'
    else if (isRush) type = 'rush'
    else if (bigCount >= 2 && isOOT) type = 'out_of_town_big'
    else if (bigCount >= 2) type = 'big_double'

    const rate = rateCard ? getRateForType(type as any, rateCard) : 9

    if (!breakdown[type]) {
      breakdown[type] = { count: 0, rate, total: 0 }
    }
    breakdown[type].count++
    breakdown[type].total += rate
  })

  const subtotal = Object.values(breakdown).reduce((sum, b) => sum + b.total, 0)
  const gst = rateCard?.applyGst ? subtotal * 0.05 : 0

  return (
    <div className="space-y-4">
      {Object.entries(breakdown).map(([type, data]) => (
        <div key={type} className="flex justify-between items-center">
          <div>
            <p className="font-medium">{getDeliveryTypeLabel(type as any)}</p>
            <p className="text-sm text-muted-foreground">
              {data.count} x {formatCurrency(data.rate)}
            </p>
          </div>
          <p className="font-medium">{formatCurrency(data.total)}</p>
        </div>
      ))}
      
      <div className="border-t border-border/50 pt-4 space-y-2">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {rateCard?.applyGst && (
          <div className="flex justify-between text-muted-foreground">
            <span>GST 5%</span>
            <span>{formatCurrency(gst)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/50">
          <span>Running Total</span>
          <span>{formatCurrency(subtotal + gst)}</span>
        </div>
      </div>
    </div>
  )
}

// Dispute Modal
function DisputeModal({
  open,
  invoice,
  lineItemId,
  onClose,
  onSubmit,
}: {
  open: boolean
  invoice: Invoice
  lineItemId: string
  onClose: () => void
  onSubmit: (claim: string, photoUrl: string | null) => void
}) {
  const [claim, setClaim] = useState('')
  const lineItem = invoice.lines.find(l => l.id === lineItemId)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispute a Charge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">Disputing charge</p>
            <p className="font-medium">{lineItem?.description}</p>
            <p className="text-lg font-bold">{formatCurrency(lineItem?.total || 0)}</p>
          </div>

          <div className="space-y-2">
            <Label>What is your concern?</Label>
            <Textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="Please describe the issue with this charge..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            <Input type="file" accept="image/*" />
            <p className="text-xs text-muted-foreground">
              Upload any supporting documentation or photos
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => onSubmit(claim, null)}
            disabled={!claim.trim()}
          >
            Submit Dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
