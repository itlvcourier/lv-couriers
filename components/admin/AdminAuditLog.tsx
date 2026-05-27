'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from 'lucide-react'
import { format } from 'date-fns'
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

const actionIcons: Record<string, React.ReactNode> = {
  create: <Plus className="w-4 h-4" />,
  update: <Edit className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  send: <Send className="w-4 h-4" />,
  approve: <Check className="w-4 h-4" />,
  reject: <X className="w-4 h-4" />,
  cancel: <X className="w-4 h-4" />,
  assign: <User className="w-4 h-4" />,
  status_change: <AlertTriangle className="w-4 h-4" />,
}

const actionColors: Record<string, string> = {
  create: 'bg-green-500/10 text-green-500',
  update: 'bg-blue-500/10 text-blue-500',
  delete: 'bg-red-500/10 text-red-500',
  send: 'bg-purple-500/10 text-purple-500',
  approve: 'bg-green-500/10 text-green-500',
  reject: 'bg-red-500/10 text-red-500',
  cancel: 'bg-orange-500/10 text-orange-500',
  assign: 'bg-blue-500/10 text-blue-500',
  status_change: 'bg-yellow-500/10 text-yellow-500',
  login: 'bg-cyan-500/10 text-cyan-500',
  logout: 'bg-gray-500/10 text-gray-500',
  export: 'bg-indigo-500/10 text-indigo-500',
}

const entityIcons: Record<string, React.ReactNode> = {
  delivery: <Package className="w-4 h-4" />,
  invoice: <FileText className="w-4 h-4" />,
  business: <Building2 className="w-4 h-4" />,
  driver: <Truck className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
}

export function AdminAuditLog() {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const fetchAuditLogs = async () => {
    const supabase = createClient()
    
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
    
    if (entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter)
    }
    
    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter)
    }
    
    if (search) {
      query = query.or(`user_email.ilike.%${search}%,entity_name.ilike.%${search}%`)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      // Table might not exist yet
      return { logs: [], total: 0 }
    }
    
    return { logs: data || [], total: count || 0 }
  }

  const { data, isLoading, mutate } = useSWR(
    ['audit-logs', page, entityFilter, actionFilter, search],
    fetchAuditLogs,
    { refreshInterval: 30000 }
  )

  const logs = data?.logs || []
  const totalLogs = data?.total || 0
  const totalPages = Math.ceil(totalLogs / pageSize)

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity Name', 'Details']
    const rows = logs.map((log: AuditLog) => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_email || 'System',
      log.user_role || '',
      log.action,
      log.entity_type,
      log.entity_name || '',
      log.details ? JSON.stringify(log.details) : '',
    ])
    
    const csvContent = [headers, ...rows].map(row => row.map((cell: string | number | null) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const formatEntityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">{totalLogs} total entries</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or entity..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40 bg-[var(--bg-card)] border-[var(--border-color)]">
            <Filter className="w-4 h-4 mr-2" />
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
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40 bg-[var(--bg-card)] border-[var(--border-color)]">
            <Filter className="w-4 h-4 mr-2" />
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
            <SelectItem value="assign">Assign</SelectItem>
            <SelectItem value="status_change">Status Change</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Log List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ScrollText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No audit logs</h3>
          <p className="text-sm text-muted-foreground">
            {search || entityFilter !== 'all' || actionFilter !== 'all' 
              ? 'No logs match your filters' 
              : 'Activity will be recorded here'}
          </p>
        </div>
      ) : (
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--border-color)]">
              {logs.map((log: AuditLog) => (
                <div key={log.id} className="p-4 hover:bg-[var(--bg-card-hover)] transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Action Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${actionColors[log.action] || 'bg-gray-500/10 text-gray-500'}`}>
                      {actionIcons[log.action] || <Settings className="w-4 h-4" />}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {formatAction(log.action)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {entityIcons[log.entity_type]}
                          <span className="ml-1">{formatEntityType(log.entity_type)}</span>
                        </Badge>
                        {log.entity_name && (
                          <span className="text-sm text-muted-foreground truncate">
                            &quot;{log.entity_name}&quot;
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{log.user_email || 'System'}</span>
                        {log.user_role && (
                          <Badge variant="secondary" className="text-xs py-0">
                            {log.user_role}
                          </Badge>
                        )}
                        <span className="text-muted-foreground/50">|</span>
                        <span>{format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                      
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded p-2">
                          <pre className="whitespace-pre-wrap break-all">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
