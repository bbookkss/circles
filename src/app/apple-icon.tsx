import { appIcon } from '@/lib/appIcon'

/**
 * Home screen icon for iOS.
 *
 * Worth having rather than letting the phone screenshot the page: the whole
 * acquisition path is a flyer scanned on a phone, so "add to home screen" is
 * a likely thing for someone to do, and the default is a blurry thumbnail of
 * whatever page they were on.
 *
 * The same mark as the tab icon (icon.svg): five pairs of shoulders round one shared head, paper
 * on ink. iOS rounds the corners itself, so the artwork is a full square with
 * the mark kept well inside the safe area. Dash lengths are explicit:
 * circumference 2*pi*54 = 339.3, split 64/36 into five.
 */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return appIcon(size.width)
}
