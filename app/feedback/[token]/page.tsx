import { FeedbackPage } from '../FeedbackPage'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params
  return <FeedbackPage token={token} />
}
