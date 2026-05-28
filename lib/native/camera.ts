import { isNativeApp, toWebSrc } from './index'

/**
 * Camera bridge.
 *
 * `takePhoto()` returns a JPEG data URL (e.g. "data:image/jpeg;base64,...") so it
 * is a drop-in replacement for the existing web camera flow in CameraCapture.
 *
 * - In the native app: opens the OS camera via @capacitor/camera, then converts
 *   the resulting file into a data URL.
 * - On the web: returns null so the caller keeps using its existing
 *   getUserMedia / <input type=file> flow.
 */

export type PhotoSource = 'camera' | 'gallery'

async function uriToDataUrl(uriOrWebPath: string): Promise<string> {
  const src = toWebSrc(uriOrWebPath)
  const res = await fetch(src)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Take a photo (camera) or pick one (gallery) using the native camera.
 * Returns a data URL, or null when not running natively (use web fallback).
 */
export async function takeNativePhoto(
  source: PhotoSource = 'camera',
  opts?: { quality?: number },
): Promise<string | null> {
  if (!isNativeApp()) return null

  // Imported lazily so the web bundle never pulls native-only code paths.
  const { Camera, MediaType, MediaTypeSelection } = await import('@capacitor/camera')

  // Ensure we have permission first (no-op if already granted).
  try {
    const status = await Camera.checkPermissions()
    if (
      (source === 'camera' && status.camera !== 'granted') ||
      (source === 'gallery' && status.photos !== 'granted')
    ) {
      await Camera.requestPermissions({
        permissions: source === 'camera' ? ['camera'] : ['photos'],
      })
    }
  } catch {
    // Some platforms (or older OS versions) auto-grant; continue regardless.
  }

  const quality = opts?.quality ?? 80

  if (source === 'gallery') {
    const result = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      multiple: false,
    })
    const first = result.results?.[0]
    if (!first) return null
    const path = first.webPath || first.uri
    if (!path) return null
    return await uriToDataUrl(path)
  }

  const result = await Camera.takePhoto({
    quality,
    correctOrientation: true,
    saveToGallery: false,
  })
  // takePhoto returns a single MediaResult.
  if (result.type !== MediaType.Photo) return null
  const path = result.webPath || result.uri
  if (!path) return null
  return await uriToDataUrl(path)
}
