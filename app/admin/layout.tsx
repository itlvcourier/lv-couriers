export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth is handled client-side in page.tsx via localStorage
  // Server-side Supabase cookies don't persist in this environment
  return <>{children}</>
}
