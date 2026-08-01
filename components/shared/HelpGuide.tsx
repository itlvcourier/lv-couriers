'use client'

import { useState, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Package,
  ScanLine,
  Truck,
  MapPin,
  CheckCircle,
  ArrowRightLeft,
  AlertTriangle,
  Building2,
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Boxes,
  Clock,
  DollarSign,
  ShieldCheck,
  X,
} from 'lucide-react'

// ============================================================================
// Role-aware help guide. Each role (driver / admin / business) gets its own
// set of chapters. Each chapter has an icon, title, summary, and ordered steps.
// ============================================================================

export type GuideRole = 'driver' | 'admin' | 'business'

interface Step {
  title: string
  detail: string
}

interface Chapter {
  id: string
  icon: typeof Package
  title: string
  summary: string
  tag?: string
  steps: Step[]
}

// ---------------------------------------------------------------------------
// DRIVER CHAPTERS
// ---------------------------------------------------------------------------
const DRIVER_CHAPTERS: Chapter[] = [
  {
    id: 'driver-overview',
    icon: Truck,
    title: 'How your app is organised',
    summary: 'A quick tour of every tab and what each one is for.',
    steps: [
      { title: 'Available tab', detail: 'Lists every unassigned job posted by businesses. Tap a job to see the pickup and dropoff addresses, then tap "Claim" to take it.' },
      { title: 'Active tab (My Jobs in dispatch mode)', detail: 'Shows every job currently assigned to you. Tap any job to see full details, navigate to the address, or start the delivery flow.' },
      { title: 'Scan tab', detail: 'Used for hub operations: Pickup (collect from business), Sort (bring to hub bin), Accept (take from hub for delivery), and Deliver (record drop-off). Only visible when your org uses zones/cross-dock.' },
      { title: 'Earnings tab', detail: 'Shows your pay per completed leg or order, your running total, and a history of credited deliveries. Only visible when driver pay is enabled.' },
      { title: 'History tab', detail: 'All your completed and failed deliveries, searchable by date.' },
      { title: 'Settings tab', detail: 'Update your notification preferences and account details.' },
    ],
  },
  {
    id: 'driver-direct',
    icon: Package,
    title: 'Completing a direct delivery',
    summary: 'Point-to-point jobs with no hub. You pick up and deliver yourself.',
    tag: 'Direct',
    steps: [
      { title: 'Claim the job', detail: 'Open Available and tap the job. Review the addresses, then tap "Claim Job". It moves immediately to your Active tab.' },
      { title: 'Head to pickup', detail: 'Tap the job in Active. Use the map button to navigate. When you arrive, tap "Arrived at Pickup" — the business receives a notification.' },
      { title: 'Collect the parcel', detail: 'Confirm identity with the business (if required), then tap "Collected". Status updates to Picked Up.' },
      { title: 'Head to dropoff', detail: 'Navigate to the recipient address. Tap "Arrived at Drop-off" when you get there.' },
      { title: 'Record delivery', detail: 'Take the required proof photo (and signature if required). Tap "Complete Delivery". The recipient gets a confirmation SMS with their proof link.' },
      { title: 'Failed attempt', detail: 'If nobody answers, tap "Failed Attempt". Enter a note. The job stays active so you or dispatch can reattempt.' },
    ],
  },
  {
    id: 'driver-crossdock',
    icon: Boxes,
    title: 'Cross-dock (hub) delivery',
    summary: 'Two-leg jobs that route through the hub. One driver picks up, another delivers.',
    tag: 'Cross-dock',
    steps: [
      { title: 'You are the pickup driver', detail: 'Claim or receive a job assigned to you. Complete the pickup exactly like a direct delivery — collect the parcel from the business.' },
      { title: 'Scan at Sort tab', detail: 'Drive to the hub. On the Scan screen tap "Sort". Scan (or manually enter) the parcel\'s label code. This records it into the hub and places it in the correct destination bin.' },
      { title: 'You are the delivery driver', detail: 'When your zone\'s bin is ready, open the Scan screen and tap "Accept". You will only see parcels assigned to your zone. Scan each parcel to take custody.' },
      { title: 'Complete delivery', detail: 'The parcel is now in your Active tab. Complete delivery exactly like a direct job — navigate, arrive, photo, confirm.' },
      { title: 'Hub check-in', detail: 'Simply opening the Sort or Accept tab automatically checks you in at the hub for 10 minutes. The admin board shows you as "Here" so dispatch knows you have arrived.' },
    ],
  },
  {
    id: 'driver-scan',
    icon: ScanLine,
    title: 'Using the scanner',
    summary: 'What each scan mode does and how manual fallback works.',
    steps: [
      { title: 'Pickup scan', detail: 'Scanned when you collect a parcel from the business. Records event: "picked up". Parcel status updates for the business and recipient.' },
      { title: 'Sort scan', detail: 'Scanned at the hub to move the parcel from your custody into the hub. Snapshot of the destination driver is taken at this moment.' },
      { title: 'Accept scan', detail: 'Scanned at the hub when you take a parcel from a bin to deliver. Moves the parcel into your custody and your Active tab.' },
      { title: 'Deliver scan', detail: 'Scanned at the recipient door to confirm delivery. Triggers proof photo request and the receipt SMS to the customer.' },
      { title: 'Manual fallback', detail: 'If scanning is not required, a list of eligible parcels appears below the scanner. Tap "Confirm" on any row to record the event without scanning.' },
      { title: 'Offline queue', detail: 'If you lose signal, scans are saved locally and sync automatically when connectivity is restored. A badge on the Scan tab shows pending syncs.' },
    ],
  },
  {
    id: 'driver-transfers',
    icon: ArrowRightLeft,
    title: 'Transferring a parcel to another driver',
    summary: 'How to hand off a parcel mid-route.',
    tag: 'Transfers',
    steps: [
      { title: 'Open Transfers tab', detail: 'Only visible when driver transfers are enabled. Shows parcels you can transfer out and incoming transfers for you to accept.' },
      { title: 'Initiate a transfer out', detail: 'Select the parcel and the receiving driver. Tap "Transfer Out". The parcel is released from your Active tab.' },
      { title: 'Receiving driver accepts', detail: 'The receiving driver sees the incoming transfer in their Transfers tab. They tap "Accept" to take custody.' },
      { title: 'Admin approval (if required)', detail: 'When transfer_requires_admin is on, an admin must approve the transfer before the receiving driver can accept.' },
    ],
  },
  {
    id: 'driver-tips',
    icon: CheckCircle,
    title: 'Tips for a smooth shift',
    summary: 'Best practices to avoid common issues.',
    steps: [
      { title: 'Keep location on', detail: 'The app tracks your GPS so the recipient can see you moving on their tracking page. Keep location services enabled while on a job.' },
      { title: 'Take a clear proof photo', detail: 'Position the parcel at the door, ensure it is in frame, and tap the shutter only when the preview shows a clear image. A blurry or blank photo will fail the minimum photo check.' },
      { title: 'Check your zone', detail: 'If your organisation uses zones, your Accept tab only shows parcels for your assigned zone. If you cannot see a parcel you expect, ask admin to check the zone assignment.' },
      { title: 'Stale location warning', detail: 'If you have not moved in 30 minutes, the "nearest driver" routing strategy will not include you. Open the app to refresh your location.' },
    ],
  },
]

// ---------------------------------------------------------------------------
// ADMIN CHAPTERS
// ---------------------------------------------------------------------------
const ADMIN_CHAPTERS: Chapter[] = [
  {
    id: 'admin-overview',
    icon: LayoutDashboard,
    title: 'Admin portal overview',
    summary: 'Navigation groups and what lives where.',
    steps: [
      { title: 'Operations group', detail: 'Dashboard (live activity), Orders (all deliveries), Dispatch (manual assignment), Sort (hub board), Transfers (in-flight handoffs).' },
      { title: 'Network group', detail: 'Zones (draw territories + assign drivers), Hubs (hub locations), Businesses (client accounts).' },
      { title: 'People group', detail: 'Drivers (roster + documents), Requests (driver applications), Reviews (customer feedback).' },
      { title: 'Finance group', detail: 'Invoices (generate, send, track), Rate Cards (pricing rules).' },
      { title: 'System group', detail: 'Settings (all operational toggles), Audit (custody event log).' },
    ],
  },
  {
    id: 'admin-zones',
    icon: MapPin,
    title: 'Setting up zones',
    summary: 'Draw territories, assign drivers, and configure routing strategy.',
    steps: [
      { title: 'Create a zone', detail: 'Go to Zones and click "New Zone". Give it a name and pick a colour. You are immediately dropped into the map drawing mode.' },
      { title: 'Draw the boundary', detail: 'Click on the map to place boundary points. Double-click or press Enter to close and save the polygon. Press Esc to cancel.' },
      { title: 'Add FSA codes', detail: 'For addresses outside the polygon, add 3-character Canadian postal codes (e.g. T2P) in the FSA field. These are the fallback matcher.' },
      { title: 'Assign drivers', detail: 'In each zone card, click "Add driver". The first driver added becomes primary. Click the star icon to change the primary driver.' },
      { title: 'Set routing strategy', detail: 'At the top of the Zones page, choose: Balanced (fewest active parcels), Nearest (closest GPS, refreshed every 30 min), Primary (starred driver only), or Pool (no auto-assign).' },
      { title: 'Set fallback driver', detail: 'Pick a fallback driver to catch any deliveries whose address matches no zone. Without this, unzoned deliveries are left unassigned.' },
      { title: 'Activate the zone', detail: 'Toggle the "Active" switch on each zone card. Inactive zones are not used for routing.' },
    ],
  },
  {
    id: 'admin-hubsort',
    icon: Boxes,
    title: 'Managing the hub sort board',
    summary: 'Oversight of cross-dock parcels and re-targeting diverged bins.',
    steps: [
      { title: 'How parcels appear', detail: 'A parcel appears on the board when a pickup driver scans it into the hub ("Sort" scan). It disappears when a delivery driver accepts it ("Accept" scan).' },
      { title: 'Reading the bins', detail: 'Each card is a destination zone. The driver bubble shows the zone\'s current primary driver and a green "Here" badge if they have checked in.' },
      { title: 'Diverged parcels (amber rows)', detail: 'An amber warning means the zone was reassigned after the parcel was sorted. The parcel is staged for the old driver but the new driver owns the zone.' },
      { title: 'Re-targeting a diverged parcel', detail: 'Expand the amber row. Use the driver picker to choose the correct driver, then click "Re-target". The parcel moves to that driver\'s bin and their Accept tab.' },
      { title: 'Board auto-refreshes', detail: 'The board polls every 15 seconds. You can also click the Refresh button at any time.' },
    ],
  },
  {
    id: 'admin-dispatch',
    icon: Truck,
    title: 'Dispatching and reassigning jobs',
    summary: 'Manual driver assignment when auto-assign is off or overriding it.',
    steps: [
      { title: 'Dispatch mode', detail: 'When "Allow driver self-claim" is OFF, drivers cannot see or claim Available jobs. All assignment is done by admin from the Dispatch screen.' },
      { title: 'Assign from Dispatch', detail: 'Open Dispatch, find the unassigned job, and click "Assign Driver". Select from the driver list. The driver sees the job immediately in their Active tab.' },
      { title: 'Reassign a job', detail: 'Open any active delivery, click the driver badge, and select a different driver. A reassignment SMS is sent to the recipient.' },
      { title: 'Pool strategy', detail: 'When routing strategy is "Pool", parcels are not auto-assigned even if zones are enabled. Use Dispatch to assign them, or drivers claim from their zone pool.' },
    ],
  },
  {
    id: 'admin-settings',
    icon: ShieldCheck,
    title: 'Key settings explained',
    summary: 'What the most important toggles actually do.',
    steps: [
      { title: 'Operating mode presets', detail: '"Direct" turns off zones, cross-dock, and optimization — good for simple point-to-point operations. "Cross-dock" turns all routing features on.' },
      { title: 'Zones enabled', detail: 'Master switch for zone-based routing. When OFF, all deliveries are unzoned and routing_mode is always "direct".' },
      { title: 'Consolidation enabled', detail: 'When OFF, cross-zone deliveries do not go through the hub even if zones are enabled. Everything stays "direct".' },
      { title: 'Barcode scanning required', detail: 'When ON, drivers must scan the physical label — the manual fallback list is hidden. Use this for high-volume ops where accuracy matters.' },
      { title: 'Proof of delivery required', detail: 'Drivers cannot complete a delivery without at least one photo. The minimum number of photos is set in Settings > Operations.' },
      { title: 'Review request delay', detail: 'How many minutes after delivery before the review SMS is sent. Default 30 min. Zero sends it immediately.' },
    ],
  },
  {
    id: 'admin-notifications',
    icon: Bell,
    title: 'Notification centre',
    summary: 'What triggers admin notifications and how to configure them.',
    steps: [
      { title: 'Rush job alerts', detail: 'When "Notify rush jobs" is ON, a notification appears whenever a business posts an urgent/rush delivery.' },
      { title: 'Timeout warnings', detail: 'When "Notify timeout warnings" is ON, you are alerted when a delivery passes its SLA threshold without being picked up or delivered.' },
      { title: 'Flag alerts', detail: 'When "Notify flag alerts" is ON, you are alerted when a delivery is failed or flagged with an exception.' },
      { title: 'Dedupe behaviour', detail: 'Each alert type is deduplicated per delivery — you will not receive the same alert twice for the same job unless it is a new event type.' },
    ],
  },
  {
    id: 'admin-invoices',
    icon: DollarSign,
    title: 'Invoices and billing',
    summary: 'How invoices are generated, sent, and tracked.',
    steps: [
      { title: 'Auto-generate drafts', detail: 'On the 28th of each month, a cron job generates draft invoices for the previous month, one per business, covering all delivered jobs.' },
      { title: 'Manual generation', detail: 'From the Invoices page, click "Generate" to create a draft for any business and date range immediately.' },
      { title: 'Review and send', detail: 'Open a draft invoice to review line items, then click "Send Invoice". The business receives an email with a PDF and a payment link.' },
      { title: 'Overdue escalation', detail: 'The system automatically marks invoices overdue and sends reminders on the configured days. Escalation notifications appear in the admin notification centre.' },
      { title: 'GST / tax', detail: 'GST is computed per delivery using the org\'s configured tax rate. GST-exempt businesses have zero GST on all their line items.' },
    ],
  },
]

// ---------------------------------------------------------------------------
// BUSINESS CHAPTERS
// ---------------------------------------------------------------------------
const BUSINESS_CHAPTERS: Chapter[] = [
  {
    id: 'biz-overview',
    icon: Building2,
    title: 'Business portal overview',
    summary: 'A tour of the tabs available to your account.',
    steps: [
      { title: 'Orders tab', detail: 'Your full delivery history. Filter by status, date, or search by reference. Click any delivery to see the full timeline and proof of delivery.' },
      { title: 'New Order', detail: 'Create a delivery request. Enter pickup (usually your address) and dropoff details. Choose priority if rush delivery is available.' },
      { title: 'Tracking tab', detail: 'Live map showing active deliveries. Click a pin to see the driver\'s name, ETA, and current status.' },
      { title: 'Invoices tab', detail: 'View, download, and track payment status for all your invoices.' },
      { title: 'Reports tab', detail: 'Delivery volume, success rates, and average delivery times for your account.' },
      { title: 'Profile tab', detail: 'Update your business name, contact details, and notification preferences.' },
    ],
  },
  {
    id: 'biz-create-order',
    icon: Package,
    title: 'Creating a delivery order',
    summary: 'Step by step from posting to confirmation.',
    steps: [
      { title: 'Open New Order', detail: 'Click the "New Order" button in the top bar or the Orders tab.' },
      { title: 'Enter pickup address', detail: 'Start typing your address. Select from the suggestions. The system will validate the address against your service area.' },
      { title: 'Enter dropoff address', detail: 'Enter the recipient\'s address. Add a unit number if needed. The estimated rate is shown once both addresses are set.' },
      { title: 'Add recipient details', detail: 'Enter the recipient\'s name and phone number. They will receive SMS updates as the delivery progresses.' },
      { title: 'Choose priority', detail: 'Standard is the default. Rush / Urgent adds a surcharge and places the job at the top of the driver queue.' },
      { title: 'Submit', detail: 'Click "Place Order". You will receive an order confirmation with a tracking link. The job is now live and available for driver assignment.' },
    ],
  },
  {
    id: 'biz-tracking',
    icon: MapPin,
    title: 'Tracking your deliveries',
    summary: 'How to follow a delivery in real time.',
    steps: [
      { title: 'Order confirmation SMS', detail: 'When you place an order, the system sends a tracking link to the recipient\'s phone. You can also copy the link from the Order detail page.' },
      { title: 'Live tracking page', detail: 'The link opens a public tracking page showing the driver\'s location on a map, the current status, and the estimated arrival time.' },
      { title: 'Status notifications', detail: 'You and the recipient receive SMS updates at each stage: driver assigned, en route to pickup, parcel collected, out for delivery, delivered.' },
      { title: 'Proof of delivery', detail: 'Once delivered, the tracking page shows the proof photo and (if collected) the recipient signature. The link stays active until the expiry period.' },
      { title: 'Tracking page expiry', detail: 'Tracking links expire after the configured window (default 72 hours after delivery). After expiry the page shows a friendly "link expired" message — no personal data is shown.' },
    ],
  },
  {
    id: 'biz-invoices',
    icon: FileText,
    title: 'Understanding your invoices',
    summary: 'How charges are calculated and how to pay.',
    steps: [
      { title: 'Monthly invoicing', detail: 'Invoices are generated at the end of each month, covering all deliveries completed in that period.' },
      { title: 'Line items', detail: 'Each delivery is a line item with description, quantity (1), unit rate, and total. The rate is determined by your rate card (distance, rush surcharge, etc.).' },
      { title: 'GST', detail: 'GST is itemised separately on each line and summed at the bottom. GST-exempt accounts show $0 GST.' },
      { title: 'Receiving your invoice', detail: 'You receive an email with the invoice PDF attached and a link to the online version. Both show payment instructions.' },
      { title: 'Disputes', detail: 'If a charge looks wrong, open the delivery from the Orders tab and click "Dispute". The admin team is notified and will follow up.' },
    ],
  },
  {
    id: 'biz-notifications',
    icon: Bell,
    title: 'Managing SMS notifications',
    summary: 'Which messages your customers receive and how to control them.',
    steps: [
      { title: 'Order confirmed', detail: 'Sent to the recipient when the order is placed, with their tracking link.' },
      { title: 'Driver en route', detail: 'Sent when the driver heads to your location for pickup.' },
      { title: 'Parcel collected', detail: 'Sent when the driver scans or confirms pickup.' },
      { title: 'Out for delivery', detail: 'Sent when the driver heads to the recipient.' },
      { title: 'Delivered', detail: 'Sent when delivery is confirmed, with a link to the proof of delivery.' },
      { title: 'Review request', detail: 'Sent a short time after delivery (default 30 minutes) asking the recipient to rate the experience.' },
      { title: 'Opt-out', detail: 'Recipients can reply STOP at any time to opt out of all future messages from this number. The system honours opt-outs automatically.' },
    ],
  },
]

const ROLE_CHAPTERS: Record<GuideRole, Chapter[]> = {
  driver: DRIVER_CHAPTERS,
  admin: ADMIN_CHAPTERS,
  business: BUSINESS_CHAPTERS,
}

const ROLE_LABELS: Record<GuideRole, string> = {
  driver: 'Driver Guide',
  admin: 'Admin Guide',
  business: 'Business Guide',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HelpGuideProps {
  role: GuideRole
  /** Optional trigger override. Defaults to a "?" icon button. */
  trigger?: React.ReactNode
}

export function HelpGuide({ role, trigger }: HelpGuideProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const chapters = ROLE_CHAPTERS[role]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return chapters
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.steps.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.detail.toLowerCase().includes(q),
        ),
    )
  }, [chapters, search])

  function toggleChapter(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpandedIds(new Set(filtered.map((c) => c.id)))
  }

  function collapseAll() {
    setExpandedIds(new Set())
  }

  const defaultTrigger = (
    <button
      type="button"
      aria-label="Open help guide"
      className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? defaultTrigger}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-md p-0 gap-0"
      >
        {/* Sheet header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="w-5 h-5 text-primary" />
              {ROLE_LABELS[role]}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 shrink-0"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                // Auto-expand matching chapters when searching.
                if (e.target.value.trim()) {
                  const q = e.target.value.trim().toLowerCase()
                  const matches = chapters.filter(
                    (c) =>
                      c.title.toLowerCase().includes(q) ||
                      c.summary.toLowerCase().includes(q) ||
                      c.steps.some(
                        (s) =>
                          s.title.toLowerCase().includes(q) ||
                          s.detail.toLowerCase().includes(q),
                      ),
                  )
                  setExpandedIds(new Set(matches.map((c) => c.id)))
                }
              }}
              placeholder="Search help topics…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Expand / collapse all */}
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Expand all
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Collapse all
            </button>
            {search && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
              <Search className="w-8 h-8 text-muted-foreground" />
              <p className="font-medium text-foreground">No results for &ldquo;{search}&rdquo;</p>
              <p className="text-sm text-muted-foreground">Try a different keyword or browse all topics.</p>
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((chapter) => {
                const expanded = expandedIds.has(chapter.id)
                const Icon = chapter.icon
                return (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.id)}
                      className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                      aria-expanded={expanded}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="w-4 h-4 text-primary" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">{chapter.title}</span>
                          {chapter.tag && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {chapter.tag}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {chapter.summary}
                        </p>
                      </div>
                      {expanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      }
                    </button>

                    {expanded && (
                      <div className="px-5 pb-4">
                        <Separator className="mb-4" />
                        <ol className="space-y-4">
                          {chapter.steps.map((step, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary mt-0.5">
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground leading-snug">
                                  {step.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                  {step.detail}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Some features depend on your organisation&apos;s settings and may not be visible.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
