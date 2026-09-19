import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { geoFromHeaders, SF_VIEW } from '@/lib/mapView'
import TopNav from '@/components/TopNav'
import NewCircleClient from './NewCircleClient'

export default async function NewCirclePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('is_business').eq('id', user.id).maybeSingle()

  // Open the pin picker where the person is. /explore has done this since
  // launch; this page was still hardcoded to San Francisco, so anyone
  // creating a circle anywhere else started by panning across the country.
  //
  // Deliberately not resolveMapView: that prefers the viewer's existing
  // circles over their location, which is right for browsing and wrong here.
  // You make a circle where you are, not where your last one was.
  const h = await headers()
  const geo = geoFromHeaders((name) => h.get(name))
  const initialView = geo
    ? { latitude: geo.latitude, longitude: geo.longitude, zoom: 12 }
    : SF_VIEW

  return (
    <>
      <TopNav />
      {/* h-screen only from md up. On a phone this is an ordinary
          scrolling page: 100vh there is the height with the browser chrome
          hidden, so a 100vh box is taller than what you can see, the page
          scrolls by the difference, and the form's own scroller ends up
          nested inside a container that is already the wrong height. That
          combination is what produced the dead space below Create Circle. */}
      <div className="pt-14 md:h-screen">
        <NewCircleClient
          isBusiness={profile?.is_business === true}
          initialView={initialView}
        />
      </div>
    </>
  )
}
