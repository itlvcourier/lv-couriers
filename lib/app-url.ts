/**
 * Public base URL for every link we send to customers, businesses and drivers
 * (SMS, email, labels). Never derived from VERCEL_URL: per-deployment Vercel
 * URLs are protected and break for recipients.
 */
export const PRODUCTION_APP_URL = 'https://doms360.ca'

export function getAppUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (configured && !/vercel\.app|localhost/i.test(configured)) {
    const withProtocol = configured.startsWith('http') ? configured : `https://${configured}`
    return withProtocol.replace(/\/$/, '')
  }
  return PRODUCTION_APP_URL
}

export function appLink(path: string): string {
  return `${getAppUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

export function trackingLink(deliveryOrCode: string): string {
  return appLink(`/track/${deliveryOrCode}`)
}

export function feedbackLink(token: string): string {
  return appLink(`/feedback/${token}`)
}
