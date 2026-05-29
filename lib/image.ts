/**
 * Normalizes an image data URL so proof/pickup photos are a consistent,
 * reasonable size on every device and platform.
 *
 * Phone cameras produce very large images (e.g. 3000x4000+), and each device
 * differs. Without normalization the same photo can look "huge" or wrongly
 * cropped depending on the device, and uploads are unnecessarily large. This
 * resizes the longest side down to `maxDimension` (keeping aspect ratio) and
 * re-encodes as JPEG, returning a new data URL.
 *
 * Runs entirely in the browser via canvas. If anything fails (e.g. SSR or a
 * decode error), it safely returns the original input.
 */
export async function normalizeImageDataUrl(
  dataUrl: string,
  maxDimension = 1600,
  quality = 0.8,
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUrl
  }
  try {
    const img = await loadImage(dataUrl)
    const { width, height } = img

    // Already small enough — keep as-is.
    if (Math.max(width, height) <= maxDimension) {
      return dataUrl
    }

    const scale = maxDimension / Math.max(width, height)
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, targetW, targetH)
    return canvas.toDataURL('image/jpeg', quality)
  } catch (err) {
    console.error('[v0] normalizeImageDataUrl failed', err)
    return dataUrl
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Safe for data URLs; avoids canvas tainting if a remote URL is ever passed.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
