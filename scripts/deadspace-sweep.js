/**
 * Dead space sweep: find pages that scroll into empty paper.
 *
 * There is no browser test runner in this project, so this is a by-hand tool.
 * Sign in, open any page on the site, paste the whole file into the console,
 * then call it:
 *
 *   await deadspaceSweep()                       // the usual routes, desktop
 *   await deadspaceSweep({ width: 390, height: 844 })   // phone
 *   await deadspaceSweep({ paths: ['/circles/new'] })
 *
 * It loads each route in a same-origin iframe sized to a real viewport, so
 * `100vh` and the breakpoints mean what they mean on a real screen.
 *
 * What it reports is `dead`: how far the document scrolls past BOTH the
 * viewport and the last thing that actually paints. Not every number above
 * zero is a bug — a container's bottom padding is deliberate breathing room
 * and shows up here as 20-60px. What matters is a large number, and
 * `escapees`, which names hidden inputs that have got out of their scroller
 * and are stretching the page on their own. That is the /circles/new bug:
 * see the comment on the rule at the end of src/app/globals.css.
 */
async function deadspaceSweep({ paths, width = 1229, height = 772, settle = 1800 } = {}) {
  const routes = paths ?? [
    '/', '/home', '/explore', '/circles/new', '/profile', '/messages',
    '/notifications', '/welcome', '/business', '/login', '/signup',
    '/forgot-password',
  ]

  const measure = (win) => {
    const D = win.document
    const doc = D.documentElement.scrollHeight
    const vh = win.innerHeight

    // How far down does a clipping ancestor let this element actually show?
    // Anything painted below that is not visible, and a fixed element is out
    // of flow, so neither can justify the document's height.
    const clipBottom = (el) => {
      let lim = Infinity
      for (let p = el; p && p !== D.body; p = p.parentElement) {
        const cs = win.getComputedStyle(p)
        if (cs.position === 'fixed') return null
        if (/hidden|auto|scroll|clip/.test(cs.overflowY)) {
          lim = Math.min(lim, p.getBoundingClientRect().bottom + win.scrollY)
        }
      }
      return lim
    }

    let content = 0
    const consider = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      const cs = win.getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.opacity === '0') return
      // The 1px hidden inputs are the thing being hunted, not content.
      if (el.tagName === 'INPUT' && el.getAttribute('aria-hidden') === 'true') return
      const lim = clipBottom(el)
      if (lim === null) return
      content = Math.max(content, Math.min(r.bottom + win.scrollY, lim))
    }

    // Text nodes, replaced elements and borders. Deliberately not "anything
    // with a background": html and body span the document by definition.
    const walker = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT)
    for (let n; (n = walker.nextNode()); ) {
      if (n.textContent.trim() && n.parentElement) consider(n.parentElement)
    }
    for (const el of D.body.querySelectorAll('img,canvas,svg,video,input,textarea,select,button,hr')) consider(el)
    for (const el of D.body.querySelectorAll('*')) {
      const cs = win.getComputedStyle(el)
      const bordered = ['Top', 'Bottom', 'Left', 'Right'].some(
        (s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none',
      )
      if (bordered) consider(el)
    }

    const escapees = [...D.querySelectorAll('input[aria-hidden="true"][tabindex="-1"]')]
      .filter((i) => win.getComputedStyle(i).position === 'absolute')
      .map((i) => `${i.name || '(unnamed)'}@${Math.round(i.getBoundingClientRect().top + win.scrollY)}`)

    return {
      doc,
      vh,
      content: Math.round(content),
      dead: Math.max(0, Math.round(doc - Math.max(vh, content))),
      escapees,
    }
  }

  const rows = []
  for (const path of routes) {
    const frame = document.createElement('iframe')
    frame.style.cssText =
      `position:fixed;left:0;top:0;width:${width}px;height:${height}px;border:0;opacity:0.01;z-index:-1`
    frame.src = path
    document.body.appendChild(frame)
    await new Promise((res) => {
      frame.onload = res
      setTimeout(res, 9000)
    })
    await new Promise((res) => setTimeout(res, settle))
    try {
      // Note the landed path: a signed-in session redirects /login to /home,
      // so a row can be a different page from the one asked for.
      rows.push({ asked: path, landed: frame.contentWindow.location.pathname, ...measure(frame.contentWindow) })
    } catch (err) {
      rows.push({ asked: path, error: String(err).slice(0, 80) })
    }
    frame.remove()
  }
  console.table(rows)
  return rows
}
