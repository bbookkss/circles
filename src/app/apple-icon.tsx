import { ImageResponse } from 'next/og'

/**
 * Home screen icon for iOS.
 *
 * Worth having rather than letting the phone screenshot the page: the whole
 * acquisition path is a flyer scanned on a phone, so "add to home screen" is
 * a likely thing for someone to do, and the default is a blurry thumbnail of
 * whatever page they were on.
 *
 * The same mark as the tab icon (icon.svg): five people round a dot, paper
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
          <path
            fill="none"
            stroke="#f7f8fa"
            strokeWidth="15"
            strokeLinecap="round"
            d="M47.531 15.257A54 54 0 0 1 84.469 15.257M108.553 32.754A54 54 0 0 1 119.967 67.885M110.768 96.196A54 54 0 0 1 80.884 117.908M51.116 117.908A54 54 0 0 1 21.232 96.196M12.033 67.885A54 54 0 0 1 23.447 32.754"
          />
          <circle cx="66" cy="32.5" r="9.5" fill="#f7f8fa" />
          <circle cx="97.86" cy="55.648" r="9.5" fill="#f7f8fa" />
          <circle cx="85.691" cy="93.102" r="9.5" fill="#f7f8fa" />
          <circle cx="46.309" cy="93.102" r="9.5" fill="#f7f8fa" />
          <circle cx="34.14" cy="55.648" r="9.5" fill="#f7f8fa" />
          <circle cx="66" cy="66" r="14" fill="#f7f8fa" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
