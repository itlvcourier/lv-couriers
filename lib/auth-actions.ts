'use server'

import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

export async function generateTemporaryPassword(): Promise<string> {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  
  // Clear localStorage by redirecting to login
  redirect('/auth/login')
}

