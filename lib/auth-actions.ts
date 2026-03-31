'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole() {
  const user = await getCurrentUser()
  if (!user) return null
  return user.user_metadata?.role || 'business'
}

export async function inviteDriver(email: string, name: string, phone: string, vehicleType: string = 'car') {
  const supabase = await createClient()
  
  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
  
  // Create the user with driver role
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      role: 'driver',
      name: name,
    },
  })

  if (authError) {
    // If admin API doesn't work, use regular signup with invite
    const { data: inviteData, error: inviteError } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: {
          role: 'driver',
          name: name,
        },
      },
    })

    if (inviteError) {
      return { error: inviteError.message }
    }

    // Create driver record
    if (inviteData.user) {
      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id: inviteData.user.id,
          name: name,
          email: email,
          phone: phone,
          vehicle_type: vehicleType,
          status: 'offline',
        })

      if (driverError) {
        console.error('Driver creation error:', driverError)
      }
    }

    return { 
      success: true, 
      tempPassword,
      message: `Driver invited. Temporary password: ${tempPassword}` 
    }
  }

  // Create driver record if admin API worked
  if (authData.user) {
    const { error: driverError } = await supabase
      .from('drivers')
      .insert({
        user_id: authData.user.id,
        name: name,
        email: email,
        phone: phone,
        vehicle_type: vehicleType,
        status: 'offline',
      })

    if (driverError) {
      console.error('Driver creation error:', driverError)
    }
  }

  return { 
    success: true, 
    tempPassword,
    message: `Driver invited. Temporary password: ${tempPassword}` 
  }
}
