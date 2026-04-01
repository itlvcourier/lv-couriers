'use server'

// Server actions for auth - all functions must be async
export async function generateTemporaryPassword(): Promise<string> {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
}
