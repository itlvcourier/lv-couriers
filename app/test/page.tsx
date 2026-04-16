'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestPage() {
  const [status, setStatus] = useState('Loading...')
  const [tables, setTables] = useState<string[]>([])

  useEffect(() => {
    const test = async () => {
      try {
        const supabase = createClient()
        
        // Test auth status
        const { data: { user } } = await supabase.auth.getUser()
        setStatus(`Auth: ${user ? user.email : 'Not authenticated'}`)

        // Test businesses query
        const { data, error } = await supabase
          .from('businesses')
          .select('id, name')
          .limit(5)

        if (error) {
          setStatus(`Error: ${error.message}`)
        } else {
          setTables((data || []).map((b: { name: string }) => b.name))
          setStatus('✓ Connected to database')
        }
      } catch (err: any) {
        setStatus(`Error: ${err.message}`)
      }
    }

    test()
  }, [])

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Database Connection Test</h1>
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <p className="text-sm font-medium">Status:</p>
          <p className="text-lg">{status}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Businesses:</p>
          <ul className="space-y-1">
            {tables.map((name, i) => (
              <li key={i} className="text-sm">• {name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
