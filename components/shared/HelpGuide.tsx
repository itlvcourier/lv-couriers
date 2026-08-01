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
  FileText,
  Bell,
  Boxes,
  Clock,
  DollarSign,
  ShieldCheck,
  Printer,
  X,
  Tag,
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
    summary: 'A quick tour of every tab and what each one does.',
    steps: [
      {
        title: 'Available tab',
        detail:
          'Lists every unassigned job posted by businesses. Each card shows the pickup address, dropoff address, package count, and whether the job is rush or out-of-town. Tap a job to see full details, then tap "Claim Job" to take it.',
      },
      {
        title: 'Active tab (My Jobs)',
        detail:
          'Shows every job currently assigned to you — both direct pickups and hub-leg deliveries. Tap any job to navigate, update status, record proof of delivery, or report a failed attempt. Jobs disappear from this tab once marked delivered or failed.',
      },
      {
        title: 'Scan tab',
        detail:
          'Used for hub (cross-dock) operations. Four modes: Pickup (scan at the business to collect), Sort (scan at the hub to check in), Accept (scan at the hub to take custody for delivery), and Deliver (scan at the door to confirm drop-off). Only visible when your organisation has hub/zone routing enabled.',
      },
      {
        title: 'Transfers tab',
        detail:
          'Used to hand off a parcel to another driver mid-route, or to accept a parcel transferred to you. Only visible when driver transfers are enabled by your admin.',
      },
      {
        title: 'Earnings tab',
        detail:
          'Shows your pay per completed leg or order, your running total for the current period, and a full history of credited deliveries. Only visible when driver pay is enabled by admin.',
      },
      {
        title: 'History tab',
        detail:
          'All your completed and failed deliveries, searchable by date or address. Tap any entry to see the full timeline, proof photo, and any notes.',
      },
      {
        title: 'Settings tab',
        detail:
          'Update your notification preferences, view your documents, and manage account details.',
      },
    ],
  },
  {
    id: 'driver-direct',
    icon: Package,
    title: 'Completing a direct delivery',
    summary: 'Point-to-point jobs — you pick up from the business and deliver to the recipient.',
    tag: 'Direct',
    steps: [
      {
        title: 'Claim the job',
        detail:
          'Open the Available tab and tap the job card. Review the pickup address, dropoff address, package count, and any special instructions. Tap "Claim Job". The job immediately moves to your Active tab and you are assigned as the driver.',
      },
      {
        title: 'Navigate to pickup',
        detail:
          'Open the job in Active and tap the map button to launch navigation. When you arrive at the business, tap "Arrived at Pickup". The business receives an SMS or notification that you are there.',
      },
      {
        title: 'Scan or confirm the parcel',
        detail:
          'If barcode scanning is required, open the Scan tab and scan the QR code on the printed label attached to the parcel. If scanning is not required, tap "Collected" on the job card to confirm you have the package. Status updates to "Picked Up" for the business and recipient.',
      },
      {
        title: 'Check the label',
        detail:
          'Before leaving the pickup location, verify the label matches the job — confirm the delivery address, recipient name, and any colour-coded zone strip. If the label is missing or unreadable, ask the business to reprint it from their Orders tab.',
      },
      {
        title: 'Navigate to dropoff',
        detail:
          'Tap the navigation icon on the Active job. When you arrive at the recipient address, tap "Arrived at Drop-off". The recipient receives an SMS notification that you are there.',
      },
      {
        title: 'Record proof of delivery',
        detail:
          'Take the required proof photo — position the parcel clearly at the door or in the recipient\'s hands and tap the shutter. If a signature is required, the signature pad will appear after the photo. A blurry or blank photo will be rejected; retake if needed.',
      },
      {
        title: 'Complete the delivery',
        detail:
          'Tap "Complete Delivery". The recipient receives a confirmation SMS with their proof-of-delivery link. The job leaves your Active tab and moves to History. If the recipient requests a review, they will receive an SMS after the configured delay (default 30 minutes).',
      },
      {
        title: 'Failed delivery attempt',
        detail:
          'If no one answers or access is denied, tap "Failed Attempt". Select a reason (no answer, access denied, wrong address, refused, other) and add a note describing what happened. The job stays in your Active tab. Dispatch or the business will follow up with instructions to retry or release the parcel.',
      },
    ],
  },
  {
    id: 'driver-crossdock',
    icon: Boxes,
    title: 'Cross-dock (hub) delivery',
    summary: 'Two-leg jobs that route through the hub. One driver picks up, a zone driver delivers.',
    tag: 'Cross-dock',
    steps: [
      {
        title: 'Leg 1: Pickup from the business',
        detail:
          'You are assigned as the pickup driver. Head to the business, scan the label at pickup (Scan tab → Pickup), and confirm collection. The parcel is now in your custody and status updates to "Picked Up".',
      },
      {
        title: 'Drive to the hub',
        detail:
          'Head to the hub location. You do not need to notify anyone — simply arriving and scanning at Sort automatically checks you in.',
      },
      {
        title: 'Sort scan at the hub',
        detail:
          'Open the Scan tab and tap "Sort". Scan the parcel\'s QR label. The system records the parcel into the hub, assigns it to the correct destination bin for its zone, and logs which driver was the destination driver at that moment. The parcel disappears from your Active tab.',
      },
      {
        title: 'Place in the correct bin',
        detail:
          'After scanning, you will see a zone colour and name on screen — place the parcel in the matching physical bin at the hub. The admin Sort board shows your parcel in the correct zone bin.',
      },
      {
        title: 'Leg 2: Accept scan (delivery driver)',
        detail:
          'You are the zone delivery driver. When your bin is ready to go, open Scan tab → Accept. You will only see parcels assigned to your zone. Scan each parcel to take custody. Each accepted parcel appears in your Active tab immediately.',
      },
      {
        title: 'Deliver from Active',
        detail:
          'The parcel is now a normal Active job. Complete delivery exactly like a direct job — navigate, arrive, record proof photo, tap "Complete Delivery".',
      },
      {
        title: 'Hub check-in',
        detail:
          'Simply opening the Sort or Accept tab automatically checks you in at the hub for 10 minutes. The admin board shows a green "Here" badge next to your name so dispatch knows you have arrived. No manual check-in is needed.',
      },
      {
        title: 'What if my zone bin is not there yet?',
        detail:
          'If parcels for your zone have not been sorted yet, the Accept tab will show no available parcels. Wait at the hub or ask dispatch — the Sort board on the admin panel shows what is in transit.',
      },
    ],
  },
  {
    id: 'driver-scan',
    icon: ScanLine,
    title: 'Using the scanner',
    summary: 'What each scan mode does, when to use it, and manual fallback.',
    steps: [
      {
        title: 'When to scan',
        detail:
          'Scan at four key moments: at business pickup, at hub sort-in, at hub accept-out, and at recipient delivery. Each scan records a timestamped custody event in the audit log and sends an SMS to the recipient at the appropriate stage.',
      },
      {
        title: 'Pickup scan',
        detail:
          'Open Scan → Pickup. Hold the camera over the QR code on the printed label. Once the code is read, confirm the package details on screen. This records "Picked Up" and notifies the recipient that their parcel is collected.',
      },
      {
        title: 'Sort scan',
        detail:
          'Open Scan → Sort after arriving at the hub. Scan the parcel\'s label. The system routes it to the correct destination bin based on the dropoff zone. You will see the zone name and colour on screen — physically place the parcel in that bin.',
      },
      {
        title: 'Accept scan',
        detail:
          'Open Scan → Accept when you are ready to take parcels from the hub for delivery. Only parcels in your zone\'s bin are shown. Scan each one to take custody — they move into your Active tab. Scanning more than one parcel per Accept session is normal for busy routes.',
      },
      {
        title: 'Deliver scan',
        detail:
          'Open Scan → Deliver at the recipient\'s door. Scan the label to trigger the proof photo and signature flow. The "Delivered" SMS is sent to the recipient once you confirm.',
      },
      {
        title: 'Manual fallback',
        detail:
          'If the camera cannot read the code (damaged label, poor lighting), tap "Manual Entry" and type the 6-character code printed below the QR. If scanning is not required by your admin, a list of eligible parcels appears below the scanner — tap "Confirm" on any row to record the event without scanning.',
      },
      {
        title: 'Offline queue',
        detail:
          'If you lose cellular signal, scans are saved locally and sync automatically when connectivity is restored. A badge on the Scan tab shows pending syncs. Do not force-quit the app while pending — wait for the badge to clear.',
      },
    ],
  },
  {
    id: 'driver-label',
    icon: Tag,
    title: 'Understanding the delivery label',
    summary: 'What every part of the printed label means and why it matters.',
    steps: [
      {
        title: 'QR code',
        detail:
          'The large QR code on the label is the unique scan token for this delivery. It is used at every scan checkpoint — pickup, sort, accept, and delivery. Never remove or cover the QR code.',
      },
      {
        title: 'Zone colour strip',
        detail:
          'The coloured bar at the top or side of the label corresponds to a delivery zone. At the hub, sort the parcel into the bin with the matching colour. If a label has no colour strip, the delivery is a direct job with no hub routing.',
      },
      {
        title: 'Recipient information',
        detail:
          'The label shows the recipient\'s full name, delivery address, phone number, and any buzz code. Verify this matches your job before leaving the business. If there is a discrepancy, alert the business immediately and do not accept the parcel.',
      },
      {
        title: 'Package type and count',
        detail:
          'The label lists the package types (Small / Big) and quantities. If you receive more or fewer packages than stated, note the discrepancy in the pickup scan notes field before proceeding.',
      },
      {
        title: 'Rush / Out of Town badges',
        detail:
          'RUSH and OOT badges on the label indicate priority jobs. Rush jobs should be delivered within 45 minutes of pickup. Out-of-town jobs may require additional drive time — plan your route before accepting.',
      },
      {
        title: 'What if there is no label?',
        detail:
          'Do not accept a parcel without a printed label attached. Ask the business to log in, go to Orders, find the delivery, and click "Print Label". Labels can be printed as letter or 4×6 inch format. A label must be affixed before you can scan the parcel.',
      },
    ],
  },
  {
    id: 'driver-transfers',
    icon: ArrowRightLeft,
    title: 'Transferring a parcel to another driver',
    summary: 'How to hand off a parcel mid-route when you cannot complete the delivery.',
    tag: 'Transfers',
    steps: [
      {
        title: 'Open the Transfers tab',
        detail:
          'Only visible when driver transfers are enabled by admin. Shows two sections: "Transfer Out" (parcels you can send to another driver) and "Incoming Transfers" (parcels being sent to you).',
      },
      {
        title: 'Initiate a transfer out',
        detail:
          'Tap the parcel you want to transfer. Select the receiving driver from the list. Add a note if needed (e.g. "leaving at hub bin 3"). Tap "Transfer Out". The parcel is released from your Active tab and the receiving driver is notified.',
      },
      {
        title: 'Receiving driver accepts',
        detail:
          'The receiving driver sees the parcel in their Incoming Transfers. They tap "Accept" to take custody. The parcel moves into their Active tab and the tracking page updates to show the new driver.',
      },
      {
        title: 'Admin approval (if required)',
        detail:
          'When transfer approval is required, the transfer sits in a pending state until an admin approves it from the Transfers board. The receiving driver cannot accept until admin confirms. You will see a "Pending Approval" badge on the transfer.',
      },
      {
        title: 'Physical handoff',
        detail:
          'A digital transfer does not move the parcel. You must physically hand the parcel to the other driver or leave it in an agreed location (e.g. hub bin). Coordinate by phone before completing the digital transfer.',
      },
    ],
  },
  {
    id: 'driver-tips',
    icon: CheckCircle,
    title: 'Tips for a smooth shift',
    summary: 'Best practices to avoid the most common problems.',
    steps: [
      {
        title: 'Keep location services on',
        detail:
          'The app tracks your GPS so the recipient can see you moving on their tracking page and dispatch can route jobs to you. Keep location services enabled (not just "while using") throughout your shift. A stale GPS (30+ minutes without movement) removes you from nearest-driver routing.',
      },
      {
        title: 'Take a clear proof photo',
        detail:
          'Stand back enough to show the parcel and the door/mailbox in the same frame. Ensure the image is in focus. Do not photograph your hand holding the parcel in the air — the photo must clearly show where the parcel was left.',
      },
      {
        title: 'Always check the label before leaving pickup',
        detail:
          'Verify the dropoff address matches what is in your app. An address mismatch discovered at the door wastes a trip. If addresses do not match, alert the business and contact dispatch before proceeding.',
      },
      {
        title: 'Check your zone in the Accept tab',
        detail:
          'If you cannot see a parcel you expect in Accept, your zone assignment may have changed or the parcel was sorted to a different bin. Contact dispatch — do not attempt to accept parcels from another driver\'s bin.',
      },
      {
        title: 'Do not force-quit with pending scans',
        detail:
          'If the Scan tab badge shows pending syncs, keep the app open and wait for a signal. Force-quitting may lose the offline queue. If you are still offline after 10 minutes, move to an area with signal before closing the app.',
      },
      {
        title: 'Rush jobs: clock starts at claim',
        detail:
          'Rush jobs are expected to be delivered within 45 minutes of pickup confirmation. If you claim a rush job and cannot deliver within that window, alert dispatch immediately rather than letting the clock expire.',
      },
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
      {
        title: 'Operations group',
        detail:
          'Dashboard (live activity: active drivers, deliveries in flight, recent events), Orders (every delivery across all businesses), Dispatch (manual assignment board), Sort (hub cross-dock board), Transfers (in-flight handoffs between drivers).',
      },
      {
        title: 'Network group',
        detail:
          'Zones (draw territories, assign drivers, set routing strategy), Hubs (hub locations and check-in radius), Businesses (client accounts, locations, rate cards, cutoffs).',
      },
      {
        title: 'People group',
        detail:
          'Drivers (roster, documents, active status), Requests (driver onboarding applications), Reviews (customer star ratings and comments).',
      },
      {
        title: 'Finance group',
        detail:
          'Invoices (generate, preview, send, track payment status), Rate Cards (pricing rules per business or location).',
      },
      {
        title: 'System group',
        detail:
          'Settings (all operational feature toggles), Audit (full custody event log — every scan, status change, and assignment), Communications (bulk SMS and notification history).',
      },
    ],
  },
  {
    id: 'admin-zones',
    icon: MapPin,
    title: 'Setting up zones',
    summary: 'Draw territories, assign drivers, and configure routing strategy.',
    steps: [
      {
        title: 'Create a zone',
        detail:
          'Go to Zones and click "New Zone". Give it a name (e.g. "NW Calgary") and pick a colour — this colour appears on labels, the hub sort board, and driver screens so everyone knows which bin to use.',
      },
      {
        title: 'Draw the boundary',
        detail:
          'Click on the map to place boundary points. Double-click or press Enter to close and save the polygon. Press Esc to cancel. You can also drag points after creation to adjust the boundary.',
      },
      {
        title: 'Add FSA codes as fallback',
        detail:
          'For addresses that fall outside the polygon (e.g. rural or edge cases), add 3-character Canadian postal codes (e.g. T2P) in the FSA field. These are matched against the first three characters of the dropoff postal code.',
      },
      {
        title: 'Assign drivers',
        detail:
          'In each zone card, click "Add driver". Multiple drivers can be assigned to a zone. The first driver added becomes the primary (starred). Click the star icon to change the primary driver. Primary driver receives auto-assigned jobs under the "Primary" routing strategy.',
      },
      {
        title: 'Set routing strategy',
        detail:
          'At the top of the Zones page, choose: Balanced (fewest active parcels), Nearest (closest GPS, refreshed every 30 min), Primary (starred driver only), or Pool (no auto-assign — dispatch manually or drivers self-claim from pool).',
      },
      {
        title: 'Set a fallback driver',
        detail:
          'Pick a fallback driver to catch deliveries whose address matches no zone. Without a fallback, unzoned deliveries are left unassigned and sit in Dispatch until manually assigned.',
      },
      {
        title: 'Activate the zone',
        detail:
          'Toggle the "Active" switch on each zone card. Inactive zones are not used for routing even if they have assigned drivers. Use this to temporarily pause a zone without deleting it.',
      },
    ],
  },
  {
    id: 'admin-hubsort',
    icon: Boxes,
    title: 'Managing the hub sort board',
    summary: 'Oversight of cross-dock parcels, bin status, and re-targeting diverged items.',
    steps: [
      {
        title: 'How the board works',
        detail:
          'The Sort board shows one card per destination zone. Each card lists how many parcels are in that bin waiting to be accepted. A parcel appears when a pickup driver performs a Sort scan. It disappears when a delivery driver performs an Accept scan.',
      },
      {
        title: 'Driver check-in indicator',
        detail:
          'Each zone card shows the zone\'s current primary driver. A green "Here" badge appears if that driver has checked in (i.e. opened the Sort or Accept tab) within the last 10 minutes. Use this to confirm drivers are at the hub before releasing parcels.',
      },
      {
        title: 'Reading the parcel rows',
        detail:
          'Expand a zone card to see individual parcels — each row shows the tracking code, destination address, and which pickup driver sorted it in. An amber row indicates a diverged parcel (zone was reassigned after sort).',
      },
      {
        title: 'Diverged parcels (amber rows)',
        detail:
          'Amber means the zone was reassigned after the parcel was sorted. The parcel is staged for the old driver but the new driver now owns the zone. This can cause the parcel to be missed. Always re-target diverged parcels before the delivery run starts.',
      },
      {
        title: 'Re-targeting a diverged parcel',
        detail:
          'Expand the amber row. Use the driver picker to select the correct delivery driver, then click "Re-target". The parcel moves to that driver\'s bin and appears in their Accept tab immediately.',
      },
      {
        title: 'Board refresh',
        detail:
          'The board auto-polls every 15 seconds. You can also click the Refresh button at any time. If a driver scans but you do not see the change, wait 15 seconds and click Refresh.',
      },
    ],
  },
  {
    id: 'admin-dispatch',
    icon: Truck,
    title: 'Dispatching and reassigning jobs',
    summary: 'Manual driver assignment when auto-assign is off or when overriding it.',
    steps: [
      {
        title: 'Dispatch mode vs self-claim',
        detail:
          'When "Allow driver self-claim" is ON, drivers see Available jobs and can claim them directly. When it is OFF, the Available tab is hidden for drivers — all assignment is done by admin from the Dispatch screen. Use dispatch mode for tightly controlled operations.',
      },
      {
        title: 'Assigning an unassigned job',
        detail:
          'Open Dispatch, find the job in the "Unassigned" column, and click "Assign Driver". Select from the list of available drivers — their active job count is shown to help balance load. The driver sees the job immediately in their Active tab and receives a push notification.',
      },
      {
        title: 'Reassigning an active job',
        detail:
          'Open any active delivery from the Orders or Dispatch screen. Click the driver badge and select a different driver. The original driver\'s job is removed and the new driver receives the job. A reassignment notification is sent to the recipient.',
      },
      {
        title: 'Pool strategy',
        detail:
          'When routing strategy is "Pool", parcels are placed in a shared pool for drivers to self-claim from their zone. Admin can still manually assign from Dispatch, but drivers can also pick up any unassigned parcel in their zone.',
      },
      {
        title: 'Approving late orders',
        detail:
          'When a business posts an order past their daily cutoff and late requests are enabled, the order enters the Approval Queue instead of going live. Review the late order request and either approve (it goes live immediately) or reject (the business is notified).',
      },
    ],
  },
  {
    id: 'admin-settings',
    icon: ShieldCheck,
    title: 'Key settings explained',
    summary: 'What the most important feature toggles actually do.',
    steps: [
      {
        title: 'Operating mode presets',
        detail:
          '"Direct" turns off zones, cross-dock, and route optimisation — good for simple point-to-point operations or small teams. "Cross-dock" turns on all routing features. These presets set multiple toggles at once; you can fine-tune individual settings after applying a preset.',
      },
      {
        title: 'Zones enabled',
        detail:
          'Master switch for zone-based routing. When OFF, all deliveries are treated as direct jobs regardless of zone assignments. Must be ON for the hub sort board to function.',
      },
      {
        title: 'Consolidation enabled',
        detail:
          'Controls whether cross-zone deliveries route through the hub. When OFF, even zoned deliveries stay as direct point-to-point jobs. Turn this ON only when you have drivers who can staff the hub.',
      },
      {
        title: 'Barcode scanning required',
        detail:
          'When ON, drivers must physically scan the printed label at each checkpoint — the manual tap-to-confirm list is hidden. Use this for high-volume or audit-sensitive operations. When OFF, drivers can confirm custody without scanning.',
      },
      {
        title: 'Late orders and cutoff enforcement',
        detail:
          'When cutoff enforcement is ON, businesses cannot post orders after their daily cutoff time. If "Late requests enabled" is also ON, businesses can still submit a late request that goes into the Approval Queue for admin review instead of being blocked outright.',
      },
      {
        title: 'Proof of delivery required',
        detail:
          'When ON, drivers cannot mark a delivery complete without at least one photo. The minimum photo count is set in Settings > Operations. Signatures are a separate optional requirement per delivery.',
      },
      {
        title: 'Review request delay',
        detail:
          'How many minutes after delivery before the review SMS is sent to the recipient. Default is 30 minutes. Setting it to 0 sends immediately. Set to a high value (e.g. 1440 = 24 hours) to give recipients time to inspect the parcel before reviewing.',
      },
    ],
  },
  {
    id: 'admin-ratecards',
    icon: DollarSign,
    title: 'Rate cards and pricing',
    summary: 'How to set up and understand pricing rules for each business or location.',
    steps: [
      {
        title: 'Where rate cards live',
        detail:
          'Go to Businesses → click a business → click a store location → open the "Rate Card" tab. Each store location has its own rate card. A new location inherits default rates that you should review before the business starts posting orders.',
      },
      {
        title: 'Flat-rate pricing',
        detail:
          'Set a fixed dollar amount for Regular, Rush, Rush+OOT, 2+ Big packages, and OOT Big packages. The system applies the highest applicable tier: Rush+OOT > Rush > 2+ Big+OOT > 2+ Big > Regular.',
      },
      {
        title: 'Distance (radius) pricing',
        detail:
          'Toggle "Use distance pricing" to switch to zone tiers based on driving distance. Add tiers (e.g. 0–5 km = $9, 5–10 km = $13, 10–20 km = $18). Each tier also has Rush and Big Parcel surcharge rates. The system measures driving distance from the store to the dropoff address.',
      },
      {
        title: 'Fallback rate',
        detail:
          'When distance pricing is on but the distance cannot be calculated (e.g. no coordinates), the system falls back to the "Fallback Rate" you set. Always configure a sensible fallback to avoid $0 billing.',
      },
      {
        title: 'GST settings',
        detail:
          'Toggle "GST Applicable" per location. When ON, 5% GST is added on top of the rate. GST-exempt businesses should have this turned OFF. GST is shown as a separate line on invoices.',
      },
      {
        title: 'Seeing the rate card in action',
        detail:
          'When a business posts an order, the live pricing preview in the order form uses their location\'s rate card in real time. After delivery, the finalised rate is locked in using confirmed (driver-verified) package quantities.',
      },
    ],
  },
  {
    id: 'admin-invoices',
    icon: FileText,
    title: 'Invoices and billing',
    summary: 'How invoices are generated, sent, tracked, and disputed.',
    steps: [
      {
        title: 'Auto-generate drafts',
        detail:
          'On the 28th of each month, a scheduled job generates draft invoices for the previous month, one per business, covering all "delivered" status jobs in that period. Only confirmed deliveries are included — pending or failed jobs are excluded.',
      },
      {
        title: 'Manual generation',
        detail:
          'From the Invoices page, click "Generate Invoice". Select the business and date range. The system calculates line items from the rate card in effect for each location at time of delivery.',
      },
      {
        title: 'Review and send',
        detail:
          'Open a draft invoice to review all line items. Each line shows delivery type, quantity, rate, and total. When satisfied, click "Send Invoice". The business receives an email with the PDF and a payment link. Status changes from "Draft" to "Sent".',
      },
      {
        title: 'Overdue escalation',
        detail:
          'The system automatically marks invoices overdue after the due date passes and sends reminder emails on the configured schedule. Escalation notifications also appear in the admin notification centre.',
      },
      {
        title: 'Disputes',
        detail:
          'When a business disputes a charge, a dispute notification appears in your notification centre. Open the invoice, find the disputed line item, and resolve or reject the dispute with a note. The business is notified of your decision.',
      },
      {
        title: 'GST and tax',
        detail:
          'GST is computed per delivery at 5% when applicable. The invoice summary shows subtotal, total GST, and grand total. GST-exempt businesses show $0 GST. The tax rate is set per organisation and cannot be changed per invoice.',
      },
    ],
  },
  {
    id: 'admin-notifications',
    icon: Bell,
    title: 'Notification centre',
    summary: 'What triggers admin notifications and how to configure them.',
    steps: [
      {
        title: 'Rush job alerts',
        detail:
          'When "Notify rush jobs" is ON, a notification appears whenever a business posts a rush/urgent delivery. This lets you monitor time-sensitive jobs and assign a driver immediately.',
      },
      {
        title: 'Timeout warnings',
        detail:
          'When "Notify timeout warnings" is ON, you are alerted when a delivery passes its SLA threshold without being picked up or delivered. Use this to catch stalled jobs before the recipient calls.',
      },
      {
        title: 'Flag and failure alerts',
        detail:
          'When "Notify flag alerts" is ON, you are alerted when a delivery is failed or flagged with an exception. Each notification links directly to the delivery so you can take action immediately.',
      },
      {
        title: 'Late order requests',
        detail:
          'When a business submits a late order request (past cutoff), it appears in both the Approval Queue and the notification centre. You must approve or reject it — approved orders go live immediately.',
      },
      {
        title: 'Dedupe behaviour',
        detail:
          'Each alert type is deduplicated per delivery — you will not receive the same alert twice for the same job unless it is a new event type. For example, a delivery can generate both a timeout warning and a failure alert.',
      },
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
    summary: 'A tour of the tabs and what each one does.',
    steps: [
      {
        title: 'Orders tab',
        detail:
          'Your full delivery history. Filter by status (pending, picked up, delivered, failed), date range, or search by tracking code or recipient name. Click any delivery to see the full event timeline, proof photos, and proof-of-delivery link.',
      },
      {
        title: 'New Order button',
        detail:
          'Opens the delivery creation form. Enter pickup (usually your store address — pre-filled automatically) and dropoff details, add recipient information, choose package type, and see a live price estimate before submitting.',
      },
      {
        title: 'Tracking tab',
        detail:
          'Live map showing all your active deliveries. Each pin shows the current status. Click a pin to see the assigned driver\'s name, current location, and estimated arrival time.',
      },
      {
        title: 'Invoices tab',
        detail:
          'View, download (PDF), and track payment status for all your invoices. Paid, sent, draft, and overdue invoices are colour-coded. Click any invoice to see a full breakdown by delivery type.',
      },
      {
        title: 'Reports tab',
        detail:
          'Delivery volume, success rates, average delivery times, and cost summaries for your account. Filter by date range or store location.',
      },
      {
        title: 'Profile tab',
        detail:
          'Update your business name, contact details, and notification preferences. If you manage multiple store locations, you can view and edit each location\'s details here.',
      },
    ],
  },
  {
    id: 'biz-create-order',
    icon: Package,
    title: 'Creating a delivery order',
    summary: 'Step-by-step from filling the form to attaching the label to your parcel.',
    steps: [
      {
        title: 'Open the New Order form',
        detail:
          'Click "New Order" in the top bar or the Orders tab. If you manage multiple store locations, make sure you have selected the correct location from the location switcher before opening the form — the pickup address and rate card will be set automatically.',
      },
      {
        title: 'Pickup address',
        detail:
          'Your store\'s pickup address is pre-filled from your location profile. If it is incorrect, contact your admin — you cannot change the registered store address from the order form. You can add a pickup contact phone number if it differs from your account default.',
      },
      {
        title: 'Select or enter recipient',
        detail:
          'Start typing a recipient name or address. The system will suggest saved contacts from your address book — select one to auto-fill all their details. For a new recipient, enter their full name, delivery address (with unit number if applicable), and mobile phone number.',
      },
      {
        title: 'Buzz code and special instructions',
        detail:
          'If the dropoff address has a building intercom, enter the buzz code in the "Buzz Code" field. Use the "Special Instructions" field for gate codes, unit locations, "leave at concierge", or other notes for the driver.',
      },
      {
        title: 'Package type and count',
        detail:
          'Enter the number of Small packages and Big packages. Small = envelope, small box, or bag. Big = any item larger than a shoebox. The count affects your billing tier — 2 or more big packages use the "2+ Big" rate. The live price preview updates as you enter quantities.',
      },
      {
        title: 'Pricing preview',
        detail:
          'The "Estimated cost" card below the package section shows your rate, GST, and total in real time using your location\'s rate card. For distance-based pricing, the estimate updates once you select a dropoff address (distance is calculated automatically). The final price is confirmed at pickup when the driver verifies package quantities.',
      },
      {
        title: 'Rush and Out of Town options',
        detail:
          'Check "Rush" for a 45-minute urgent delivery — a surcharge applies (shown in the pricing preview). Check "Out of Town" if the delivery address is outside the standard service area. Do not check Out of Town for in-city addresses — it will change your billing tier incorrectly.',
      },
      {
        title: 'Proof and signature requirements',
        detail:
          'Check "Require photo proof" (on by default) to require the driver to take a photo at delivery. Check "Require signature" if you need the recipient to sign. Both are recommended for high-value parcels.',
      },
      {
        title: 'Submit the order',
        detail:
          'Click "Place Order". If you are past your daily cutoff and late requests are enabled, you will be asked to provide a reason — the order will go into an approval queue instead of posting immediately. Otherwise, the order is live and available for driver assignment.',
      },
      {
        title: 'Print and attach the label immediately',
        detail:
          'After the order is posted, a "Print Label" dialog appears. Print the label now — do not skip this step. The label contains the QR code that drivers must scan to take custody of your parcel. Select label size (Letter for a standard printer, 4×6 for a thermal label printer) and click Print. Attach the printed label securely to the outside of the parcel before the driver arrives.',
      },
      {
        title: 'What if I missed printing the label?',
        detail:
          'Go to Orders, find the delivery, and click the print icon (or open the delivery detail and click "Print Label"). You can reprint a label at any time. The driver cannot scan the parcel into the system without a physical label attached.',
      },
    ],
  },
  {
    id: 'biz-labels',
    icon: Printer,
    title: 'Printing and attaching labels',
    summary: 'How labels work, what they contain, and best practices for affixing them.',
    steps: [
      {
        title: 'When to print',
        detail:
          'Print the label immediately after creating the order. The label must be physically attached to the parcel before the driver arrives. If the driver arrives without a label, they cannot scan the parcel and the order will be delayed.',
      },
      {
        title: 'Label sizes',
        detail:
          'Letter (8.5×11 in): use with any standard office printer. Prints one label per page. 4×6 in: use with a thermal label printer (e.g. Dymo, Zebra, Rollo). Stick directly onto the parcel. Select the size that matches your printer in the Print Label dialog.',
      },
      {
        title: 'What the label contains',
        detail:
          'The QR scan code (required for all scan checkpoints), a colour-coded zone stripe (tells the driver which hub bin to use), recipient name and address, your store name, pickup address, package type and count, and any Rush or Out-of-Town badges.',
      },
      {
        title: 'Affixing the label',
        detail:
          'Attach the label to the largest flat surface of the parcel. Use clear packing tape over the entire label surface to protect it from moisture and handling damage. Do not fold or wrap the label around a corner — the QR code must lie flat and be scannable. Ensure the label is fully visible and not partially hidden by straps or wrapping.',
      },
      {
        title: 'Multiple packages on one order',
        detail:
          'One order generates one label. If you are sending multiple parcels as part of the same order, print one label and attach it to the primary parcel. Group all parcels together so the driver can collect them as a set. Add a note in Special Instructions indicating the total number of pieces.',
      },
      {
        title: 'Reprinting a label',
        detail:
          'Open Orders, find the delivery, and click the printer icon. You can reprint as many times as needed. If the label was damaged in transit, ask dispatch — they can issue a reprint from the admin panel as well.',
      },
    ],
  },
  {
    id: 'biz-tracking',
    icon: MapPin,
    title: 'Tracking your deliveries',
    summary: 'How to follow a delivery in real time and share tracking with your customer.',
    steps: [
      {
        title: 'Recipient tracking link',
        detail:
          'When you place an order, the system automatically sends a tracking SMS to the recipient\'s phone. The message contains a link to a public tracking page showing live driver location, current status, and ETA.',
      },
      {
        title: 'Copying the tracking link',
        detail:
          'Open the delivery detail from your Orders tab and click "Copy tracking link". Share this with the recipient via email, WhatsApp, or any channel if they did not receive the SMS.',
      },
      {
        title: 'Live Tracking tab',
        detail:
          'The Tracking tab in your portal shows a live map of all your active deliveries. Each pin is colour-coded by status — pending (grey), picked up (blue), out for delivery (orange), delivered (green). Click a pin to see driver details and ETA.',
      },
      {
        title: 'SMS status updates',
        detail:
          'Depending on your notification settings, the recipient receives SMS at: order confirmed, driver assigned, parcel collected, driver en route to delivery, and delivered (with proof photo link). You can turn individual notifications on or off in your Profile settings.',
      },
      {
        title: 'Proof of delivery',
        detail:
          'Once delivered, the tracking page shows the timestamp, proof photo, and recipient signature (if collected). The link stays active for the configured window (default 72 hours). Save or download the proof image from the delivery detail in your Orders tab.',
      },
      {
        title: 'Tracking page expiry',
        detail:
          'Tracking links expire after the configured window after delivery. After expiry the page shows a "link expired" message. The proof of delivery is still accessible from your Orders tab indefinitely.',
      },
    ],
  },
  {
    id: 'biz-invoices',
    icon: FileText,
    title: 'Understanding your invoices',
    summary: 'How charges are calculated, what each line means, and how to pay or dispute.',
    steps: [
      {
        title: 'Monthly invoicing cycle',
        detail:
          'Invoices are generated near the end of each month covering all "delivered" status orders from that period. Orders that are still in-flight, failed, or cancelled are not included. You receive an email notification when your invoice is ready.',
      },
      {
        title: 'Line items',
        detail:
          'Each line shows a delivery type (Regular, Rush, 2+ Big, OOT, Rush+OOT), the quantity of deliveries of that type, the unit rate from your rate card, and the subtotal. Rates are determined by your location\'s rate card at the time of delivery.',
      },
      {
        title: 'Distance-based billing',
        detail:
          'If your location uses distance-based pricing, each delivery is billed according to the zone tier that matches the driving distance from your store to the dropoff address. The tier name and distance appear in the delivery detail.',
      },
      {
        title: 'GST',
        detail:
          'GST (5%) is itemised separately per line and summed at the bottom. If your account is GST-exempt, all GST values will show $0. Contact your account manager if your GST status is incorrect.',
      },
      {
        title: 'Receiving your invoice',
        detail:
          'You receive an email with the invoice PDF attached and a link to the online version in your portal. Both show payment instructions. The due date is printed at the top of the invoice.',
      },
      {
        title: 'Paying your invoice',
        detail:
          'Click "Pay Invoice" from the Invoices tab or use the link in the email. Once payment is confirmed, the invoice status changes to "Paid". If you pay by EFT or cheque, contact dispatch to manually mark it paid.',
      },
      {
        title: 'Disputing a charge',
        detail:
          'If a charge looks incorrect, open the delivery from the Orders tab, click "Dispute", and enter a brief description of the issue. The admin team is notified and will review. You can track the dispute status from the invoice detail.',
      },
    ],
  },
  {
    id: 'biz-cutoffs',
    icon: Clock,
    title: 'Daily order cutoffs',
    summary: 'What the cutoff means, how it affects your orders, and what to do if you miss it.',
    steps: [
      {
        title: 'What is the cutoff time?',
        detail:
          'Your store\'s daily cutoff is the latest time you can post a new delivery for same-day service. Orders posted before the cutoff are accepted immediately. Orders posted after the cutoff are handled according to your account settings (blocked or sent for approval).',
      },
      {
        title: 'Where to find your cutoff time',
        detail:
          'Your cutoff time is shown in your Profile tab under "Delivery Cutoff". If no cutoff time is shown, your account does not have cutoff enforcement enabled — contact your courier to confirm your service hours.',
      },
      {
        title: 'Posting before the cutoff',
        detail:
          'All orders posted before the cutoff are submitted immediately and go live for driver assignment. You will see a countdown in the order form when you are within 30 minutes of your cutoff.',
      },
      {
        title: 'Posting after the cutoff',
        detail:
          'If late order requests are enabled for your account, you will be prompted to enter a reason (e.g. "urgent same-day shipment"). The order enters an approval queue and you will receive a notification once admin approves or rejects it. If late requests are not enabled, you will not be able to post until the next business day.',
      },
      {
        title: 'Multiple store locations',
        detail:
          'Each store location can have its own cutoff time. Make sure you have selected the correct location before posting an order. The cutoff displayed in the order form is for the currently selected location.',
      },
    ],
  },
  {
    id: 'biz-notifications',
    icon: Bell,
    title: 'Managing SMS notifications',
    summary: 'Which messages your customers receive and how to control them.',
    steps: [
      {
        title: 'Order confirmed',
        detail:
          'Sent to the recipient when the order is placed, with their tracking link. This is the first SMS they receive and sets expectations for the delivery.',
      },
      {
        title: 'Driver assigned',
        detail:
          'Sent when a driver is assigned to the job. Includes the driver\'s first name so the recipient knows who to expect.',
      },
      {
        title: 'Driver en route to pickup',
        detail:
          'Sent when the driver heads to your location for collection.',
      },
      {
        title: 'Parcel collected',
        detail:
          'Sent when the driver scans or confirms pickup at your store. The recipient knows the parcel is in transit.',
      },
      {
        title: 'Out for delivery',
        detail:
          'Sent when the driver heads to the recipient after leaving the hub or pickup.',
      },
      {
        title: 'Delivered',
        detail:
          'Sent when delivery is confirmed, with a link to view the proof of delivery photo and (if applicable) the recipient\'s signature.',
      },
      {
        title: 'Review request',
        detail:
          'Sent a short time after delivery (default 30 minutes) asking the recipient to rate the experience. Responses are visible to you in your Reports tab.',
      },
      {
        title: 'Opt-out',
        detail:
          'Recipients can reply STOP at any time to opt out of all future messages from this number. The system honours opt-outs automatically and no further SMS will be sent to that number.',
      },
      {
        title: 'Turning notifications on or off',
        detail:
          'Each notification type can be toggled individually in your Profile tab under "Notification Settings". Note: some notifications (e.g. Delivered) cannot be turned off as they are required for proof of delivery.',
      },
    ],
  },
  {
    id: 'biz-tips',
    icon: CheckCircle,
    title: 'Tips for a smooth dispatch experience',
    summary: 'Best practices to keep your deliveries running without issues.',
    steps: [
      {
        title: 'Print labels before the driver arrives',
        detail:
          'The driver cannot proceed without a scannable label on the parcel. Print as soon as the order is placed and attach before the driver arrives. A driver waiting for a label delays the entire route.',
      },
      {
        title: 'Double-check recipient phone numbers',
        detail:
          'An incorrect phone number means the recipient misses all SMS updates and the driver cannot call if there is an access issue. Always verify the mobile number before submitting.',
      },
      {
        title: 'Use saved contacts for repeat deliveries',
        detail:
          'Check "Save to address book" when posting to a new recipient. Next time, start typing their name and select from suggestions — all their details (address, buzz code, phone) auto-fill.',
      },
      {
        title: 'Post before your cutoff',
        detail:
          'Orders posted near or past the cutoff risk being delayed to the next business day. Post bulk orders in the morning to give your courier maximum lead time.',
      },
      {
        title: 'Include buzz codes and access notes',
        detail:
          'Apartment buildings, gated communities, and secure offices often require access codes. Always fill in the Buzz Code and Special Instructions fields for these addresses — a driver without access information will fail the attempt.',
      },
      {
        title: 'Reorder for repeat deliveries',
        detail:
          'From the Orders tab, find a previous delivery and click "Reorder". The form pre-fills all recipient details from the original order. Review and update anything that has changed, then submit.',
      },
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
