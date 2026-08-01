// Suppress the transient "Router action dispatched before initialization" error
// that fires in development when Next.js's HMR WebSocket pushes a refresh
// (hmrRefresh) immediately after an env reload, before the App Router has
// finished re-initializing. This is an internal Next.js race condition; it
// does not affect functionality or production builds.
if (typeof window !== 'undefined') {
  const originalOnError = window.onerror

  window.onerror = function (message, source, lineno, colno, error) {
    if (
      typeof message === 'string' &&
      message.includes('Router action dispatched before initialization')
    ) {
      return true // suppressed
    }
    if (originalOnError) {
      return originalOnError.call(this, message, source, lineno, colno, error)
    }
    return false
  }

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (
        event.reason?.message?.includes(
          'Router action dispatched before initialization',
        )
      ) {
        event.preventDefault()
      }
    },
    { capture: true },
  )
}
