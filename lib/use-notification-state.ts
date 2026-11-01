'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const MAX_READ_KEYS = 500

interface NotificationState {
  clearedAt: string
  readKeys: string[]
}

async function loadState(userId: string): Promise<NotificationState> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notification_state')
    .select('cleared_at, read_keys')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (data) return { clearedAt: data.cleared_at as string, readKeys: (data.read_keys as string[]) ?? [] }

  // First visit on any device: treat everything that already happened as
  // read, so a new login doesn't surface a week of stale alerts.
  const { data: created, error: insertError } = await supabase
    .from('notification_state')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('cleared_at, read_keys')
    .maybeSingle()
  if (insertError) throw insertError
  if (created) return { clearedAt: created.cleared_at as string, readKeys: (created.read_keys as string[]) ?? [] }
  return loadState(userId)
}

export function useNotificationState(userId: string | undefined) {
  const { data, mutate, isLoading } = useSWR(
    userId ? ['notification_state', userId] : null,
    () => loadState(userId as string),
    { revalidateOnFocus: true, dedupingInterval: 10_000 },
  )

  const isRead = useCallback(
    (key: string, timestamp: string) => {
      if (!data) return true
      if (new Date(timestamp).getTime() <= new Date(data.clearedAt).getTime()) return true
      return data.readKeys.includes(key)
    },
    [data],
  )

  const save = useCallback(
    async (next: NotificationState) => {
      if (!userId) return
      await mutate(
        async () => {
          const supabase = createClient()
          const { error } = await supabase.from('notification_state').upsert(
            {
              user_id: userId,
              cleared_at: next.clearedAt,
              read_keys: next.readKeys,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          if (error) throw error
          return next
        },
        { optimisticData: next, rollbackOnError: true, revalidate: false },
      )
    },
    [mutate, userId],
  )

  const markRead = useCallback(
    (key: string) => {
      if (!data || data.readKeys.includes(key)) return
      const readKeys = [...data.readKeys, key].slice(-MAX_READ_KEYS)
      void save({ ...data, readKeys }).catch(err => console.error('[notifications] markRead failed', err))
    },
    [data, save],
  )

  const markAllRead = useCallback(() => {
    void save({ clearedAt: new Date().toISOString(), readKeys: [] }).catch(err =>
      console.error('[notifications] markAllRead failed', err),
    )
  }, [save])

  return { ready: Boolean(data) && !isLoading, isRead, markRead, markAllRead }
}
