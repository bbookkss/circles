import { ImageResponse } from 'next/og'

/**
 * Browser tab icon, drawn in code rather than shipped as a binary.
 *
 * A ring, because that is what the product is called and what the logo mark
 * already is on the landing and welcome pages. Ink ground with a bone ring
 * rather than the reverse: a tab strip is usually pale, so the dark square
 * gives the icon an edge to sit against, and the ring stays legible where a
 * bone-on-bone mark would dissolve into the browser chrome.
 *
 * The stroke is deliberately heavy. At 16px a hairline ring turns to mush,
 * and this has to survive being rendered at half the size it is drawn.
 */

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '4px solid #ece3d5',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
