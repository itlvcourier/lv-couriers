'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ScrollText,
  Search,
  Filter,
  User,
  Package,
  FileText,
  Building2,
  Truck,
  Settings,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Send,
  Check,
  X,
  AlertTriangle,
  LogIn,
  LogOut,
  RotateCcw,
  Ban,
} from 'lucide-react'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

type AuditLog = {
  id: string
  user_id: string | null
  user_email: string | null
  user_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  create:        { icon: Plus,         color: 'text-green-400',  bg: 'bg-green-500/10' },
  update:        { icon: Edit,         color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  delete:        { icon: Trash2,       color: 'text-red-400',    bg: 'bg-red-500/10' },
  send:          { icon: Send,         color: 'text-purple-400', bg: 'bg-purple-500/10' },
  approve:       { icon: Check,        color: 'text-green-400',  bg: 'bg-green-500/10' },
  reject:        { icon: X,            color: 'text-red-400',    bg: 'bg-red-500/10' },
  cancel:        { icon: X,            color: 'text-orange-400', bg: 'bg-orange-500/10' },
  assign:        { icon: User,         color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  status_change: { icon: AlertTriangle,color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  login:         { icon: LogIn,        color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
  logout:        { icon: LogOut,       color: 'text-gray-400',   bg: 'bg-gray-500/10' },
  export:        { icon: Download,     color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  retry:         { icon: RotateCcw,    color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  deactivate:    { icon: Ban,          color: 'text-red-400',    bg: 'bg-red-500/10' },
}

const ENTITY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  delivery:      { icon: Package,   color: 'text-[var(--accent-orange)]' },
  invoice:       { icon: FileText,  color: 'text-blue-400' },
  business:      { icon: Building2, color: 'text-purple-400' },
  driver:        { icon: Truck,     color: 'text-green-400' },
  user:          { icon: User,      color: 'text-cyan-400' },
  system:        { icon: Settings,  color: 'text-gray-400' },
}

const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] border-[var(--accent-orange)]/20',
  driver:   'bg-green-500/10 text-green-400 border-green-500/20',
  business: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  system:   'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

function groupByDate(logs: AuditLog[]): Array<{ label: string; logs: AuditLog[] }> {
  const groups: Record<string, AuditLog[]> = {}
  for (const log of logs) {
    const d = new Date(log.created_at)
    const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
    if (!groups[key]) groups[key] = []
    groups[key].push(log)
  }
  return Object.entries(groups).map(([label, logs]) => ({ label, logs }))
}

export function AdminAuditLog() {
  const [search, setSearch]             = useState('')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [page, setPage]                 = useState(1)
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const pageSize = 50

  const fetchLogs = async () => {
    const supabase = createClient()
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter)
    if (actionFilter !== 'all') query = query.eq('action', actionFilter)
    if (search.trim()) {
      query = query.or(`user_email.ilike.%${search}%,entity_name.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) return { logs: [] as AuditLog[], total: 0 }
    return { logs: (data || []) as AuditLog[], total: count || 0 }
  }

  const { data, isLoading } = useSWR(
    ['audit-logs', page, entityFilter, actionFilter, search],
    fetchLogs,
    { refreshInterval: 30000 },
  )

  const logs        = data?.logs  || []
  const totalLogs   = data?.total || 0
  const totalPages  = Math.ceil(totalLogs / pageSize)
  const grouped     = groupByDate(logs)

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity Name', 'Details', 'IP']
    const rows = logs.map((log: AuditLog) => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_email || 'System',
      log.user_role  || '',
      log.action,
      log.entity_type,
      log.entity_name || '',
      log.details ? JSON.stringify(log.details) : '',
      log.ip_address  || '',
    ])
    const csv  = [headers, ...rows].map(r => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            {totalLogs.toLocaleString()} total entries
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2 self-start sm:self-auto">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or entity..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40 bg-[var(--bg-card)] border-[var(--border-color)]">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="driver">Driver</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="store_request">Store Request</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40 bg-[var(--bg-card)] border-[var(--border-color)]">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="send">Send</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="cancel">Cancel</SelectItem>
            <SelectItem value="assign">Assign</SelectItem>
            <SelectItem value="status_change">Status Change</SelectItem>
            <SelectItem value="login">Login</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="w-8 h-8" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ScrollText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1 text-foreground">No audit logs</h3>
          <p className="text-sm text-muted-foreground">
            {search || entityFilter !== 'all' || actionFilter !== 'all'
              ? 'No logs match your filters'
              : 'Activity will appear here as admins make changes'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ label, logs: dayLogs }) => (
            <div key={label} className="space-y-1">
              {/* Date separator */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <span className="text-xs text-muted-foreground">{dayLogs.length} events</span>
              </div>

              <Card className="bg-[var(--bg-card)] border-[var(--border-color)] overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y divide-[var(--border-color)]">
                    {dayLogs.map((log) => {
                      const actionCfg  = ACTION_CONFIG[log.action]  || { icon: Settings, color: 'text-muted-foreground', bg: 'bg-muted/20' }
                      const entityCfg  = ENTITY_CONFIG[log.entity_type] || { icon: Settings, color: 'text-muted-foreground' }
                      const ActionIcon = actionCfg.icon
                      const EntityIcon = entityCfg.icon
                      const hasDetails = log.details && Object.keys(log.details).length > 0
                      const isExpanded = expandedId === log.id

                      return (
                        <div
                          key={log.id}
                          className="p-3.5 hover:bg-[var(--bg-card-hover)] transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {/* Action icon */}
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${actionCfg.bg}`}>
                              <ActionIcon className={`w-3.5 h-3.5 ${actionCfg.color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-foreground">
                                  {formatLabel(log.action)}
                                </span>

                                {/* Entity type badge */}
                                <span className={`flex items-center gap-1 text-xs ${entityCfg.color}`}>
                                  <EntityIcon className="w-3 h-3" />
                                  {formatLabel(log.entity_type)}
                                </span>

                                {log.entity_name && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    &ldquo;{log.entity_name}&rdquo;
                                  </span>
                                )}
                              </div>

                              {/* Meta row */}
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">
                                  {log.user_email || 'System'}
                                </span>
                                {log.user_role && (
                                  <Badge variant="outline" className={`text-[10px] h-4 px-1.5 py-0 ${ROLE_COLORS[log.user_role] || ''}`}>
                                    {log.user_role}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground/50">
                                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                </span>
                                <span className="text-xs text-muted-foreground/40">
                                  {format(new Date(log.created_at), 'h:mm a')}
                                </span>
                              </div>

                              {/* Expandable details */}
                              {hasDetails && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                    className="mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {isExpanded ? 'Hide details' : 'Show details'}
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-2 text-xs text-muted-foreground bg-[var(--bg-card-2)] rounded-md p-2.5 font-mono">
                                      <pre className="whitespace-pre-wrap break-all leading-relaxed">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} &middot; {totalLogs} entries
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
