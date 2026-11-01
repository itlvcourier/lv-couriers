import { cn } from '@/lib/utils'

const PROGRESS: Record<string, number> = {
  posted: 4,
  pending: 4,
  claimed: 18,
  assigned: 18,
  en_route_pickup: 34,
  picked_up: 56,
  en_route_dropoff: 78,
  in_transit: 78,
  failed_retry: 78,
  delivered: 100,
  failed_permanent: 100,
  cancelled: 0,
}

const MOVING = new Set(['claimed', 'assigned', 'en_route_pickup', 'picked_up', 'en_route_dropoff', 'in_transit'])

export function RouteTrack({ status, className }: { status: string; className?: string }) {
  const pct = PROGRESS[status] ?? 0
  const delivered = status === 'delivered'
  const halted = status === 'cancelled' || status.startsWith('failed')
  const moving = MOVING.has(status)

  return (
    <div className={cn('relative h-3 w-full', className)} aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <span
        className={cn(
          'absolute left-0 top-1/2 h-px -translate-y-1/2 transition-[width] duration-700 ease-out',
          delivered ? 'bg-success' : halted ? 'bg-muted-foreground/40' : 'bg-brand',
        )}
        style={{ width: `${pct}%` }}
      />
      <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foreground" />
      <span
        className={cn(
          'absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border',
          delivered ? 'border-success bg-success' : 'border-muted-foreground/60 bg-card',
        )}
      />
      {moving && (
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-brand animate-route-pulse"
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  )
}
