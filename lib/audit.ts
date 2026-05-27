'use server'

import { createClient } from '@/lib/supabase/server'

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'login' 
  | 'logout'
  | 'assign'
  | 'unassign'
  | 'status_change'
  | 'send'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'dispute'
  | 'resolve'
  | 'export'
  | 'import'

export type AuditEntityType = 
  | 'delivery'
  | 'invoice'
  | 'business'
  | 'driver'
  | 'user'
  | 'location'
  | 'rate_card'
  | 'store_request'
  | 'system'

interface AuditLogEntry {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  entityName?: string
  details?: Record<string, unknown>
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('[Audit] No user found for audit log')
      return
    }
    
    // Get user details from users table
    const { data: userData } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', user.id)
      .single()
    
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        user_email: userData?.email || user.email,
        user_role: userData?.role || 'unknown',
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        entity_name: entry.entityName || null,
        details: entry.details || null,
      })
    
    if (error) {
      console.error('[Audit] Failed to log audit event:', error)
    }
  } catch (err) {
    console.error('[Audit] Error logging audit event:', err)
  }
}

export async function getAuditLogs(options?: {
  limit?: number
  offset?: number
  entityType?: AuditEntityType
  action?: AuditAction
  userId?: string
  startDate?: string
  endDate?: string
}) {
  const supabase = await createClient()
  
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
  
  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType)
  }
  
  if (options?.action) {
    query = query.eq('action', options.action)
  }
  
  if (options?.userId) {
    query = query.eq('user_id', options.userId)
  }
  
  if (options?.startDate) {
    query = query.gte('created_at', options.startDate)
  }
  
  if (options?.endDate) {
    query = query.lte('created_at', options.endDate)
  }
  
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }
  
  const { data, error, count } = await query
  
  if (error) {
    console.error('[Audit] Failed to fetch audit logs:', error)
    return { logs: [], total: 0 }
  }
  
  return { logs: data || [], total: count || 0 }
}
