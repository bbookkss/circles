import { ImageResponse } from 'next/og'

/**
 * Home screen icon for iOS.
 *
 * Worth having rather than letting the phone screenshot the page: the whole
 * acquisition path is a flyer scanned on a phone, so "add to home screen" is
 * a likely thing for someone to do, and the default is a blurry thumbnail of
 * whatever page they were on.
 *
 * The same mark as the tab icon (icon.svg): five dashes around a dot, paper
 * on ink. iOS rounds the corners itself, so the artwork is a full square with
 * the mark kept well inside the safe area. Dash lengths are explicit:
 * circumference 2*pi*54 = 339.3, split 64/36 into five.
 */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a2230',
        }}
      >
        <svg width="132" height="132" viewBox="0 0 132 132">
          <circle cx="66" cy="66" r="54" fill="none" stroke="#f7f8fa" strokeWidth="11"
            strokeLinecap="round" strokeDasharray="43.43 24.43" transform="rotate(-90 66 66)" />
          <circle cx="66" cy="66" r="17" fill="#f7f8fa" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
