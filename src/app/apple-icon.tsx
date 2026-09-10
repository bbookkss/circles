import { ImageResponse } from 'next/og'

/**
 * Home screen icon for iOS.
 *
 * Worth having rather than letting the phone screenshot the page: the whole
 * acquisition path is a flyer scanned on a phone, so "add to home screen" is
 * a likely thing for someone to do, and the default is a blurry thumbnail of
 * whatever page they were on.
 *
 * Same ring as the tab icon, at 180px with proportionally lighter stroke.
 * iOS rounds the corners itself, so the artwork is a full square with the
 * mark kept well inside the safe area.
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
          background: '#28231e',
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: '50%',
            border: '14px solid #ece3d5',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
