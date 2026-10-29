/**
 * True when the browser tab is in the background. Pollers check this so idle
 * tabs stop hitting Supabase — the free tier counts every request.
 */
export function isPageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}
