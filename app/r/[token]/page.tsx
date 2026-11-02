import { redirect } from 'next/navigation'

export default async function ShortReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  redirect(`/feedback/${encodeURIComponent(token)}`)
}
