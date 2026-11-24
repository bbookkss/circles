import type { MetadataRoute } from 'next'

/**
 * Makes Circles installable: "Add to Home Screen" on iPhone, "Install app"
 * on Android and desktop Chrome. Opens full screen at Home (signed-out people
 * land on the login page from there, as they would anyway).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Circles',
    short_name: 'Circles',
    description: 'Local groups that meet every week. See who is coming before you go.',
    id: '/',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f8fa',
    theme_color: '#f7f8fa',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
