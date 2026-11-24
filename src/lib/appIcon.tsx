import { ImageResponse } from 'next/og'

/**
 * The app mark as a square PNG, paper on ink: five shoulders round one shared
 * head. Used for the iOS home-screen icon and the web app manifest. The mark
 * sits inside the middle 73%, so Android's maskable crop (a circle of 80%)
 * never cuts it.
 */
const MARK = 'M47.500 11.000A18.500 17.500 0.00 0 0 84.500 11.000A55.000 55.000 0 0 0 47.500 11.000ZM112.591 31.410A18.500 17.500 72.00 0 0 124.025 66.599A55.000 55.000 0 0 0 112.591 31.410ZM113.295 99.622A18.500 17.500 144.00 0 0 83.361 121.370A55.000 55.000 0 0 0 113.295 99.622ZM48.639 121.370A18.500 17.500 -144.00 0 0 18.705 99.622A55.000 55.000 0 0 0 48.639 121.370ZM7.975 66.599A18.500 17.500 -72.00 0 0 19.409 31.410A55.000 55.000 0 0 0 7.975 66.599Z'

export function appIcon(px: number) {
  const mark = Math.round(px * (132 / 180))
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a2230' }}>
        <svg width={mark} height={mark} viewBox="0 0 132 132">
          <path fill="#f7f8fa" stroke="#f7f8fa" strokeWidth="3" strokeLinejoin="round" d={MARK} />
          <circle cx="66" cy="66" r="17" fill="#f7f8fa" />
        </svg>
      </div>
    ),
    { width: px, height: px }
  )
}
