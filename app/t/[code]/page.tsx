import { redirect } from 'next/navigation'

export default async function ShortTrackingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/track/${encodeURIComponent(code)}`)
}
