import { ImageResponse } from 'next/og'

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
            fill="#f7f8fa"
            stroke="#f7f8fa"
            strokeWidth="3"
            strokeLinejoin="round"
            d="M47.500 11.000A18.500 17.500 0.00 0 0 84.500 11.000A55.000 55.000 0 0 0 47.500 11.000ZM112.591 31.410A18.500 17.500 72.00 0 0 124.025 66.599A55.000 55.000 0 0 0 112.591 31.410ZM113.295 99.622A18.500 17.500 144.00 0 0 83.361 121.370A55.000 55.000 0 0 0 113.295 99.622ZM48.639 121.370A18.500 17.500 -144.00 0 0 18.705 99.622A55.000 55.000 0 0 0 48.639 121.370ZM7.975 66.599A18.500 17.500 -72.00 0 0 19.409 31.410A55.000 55.000 0 0 0 7.975 66.599Z"
          />
          <circle cx="66" cy="66" r="17" fill="#f7f8fa" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
