'use server'

// Server actions - all must be async per Next.js requirements
// Updated: 2025-03-31 - Fix build cache issue
export async function generateTemporaryPassword(): Promise<string> {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
}
