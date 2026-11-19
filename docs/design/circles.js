/* Circles mockup kit: nav, theme toggle, map.
   Usage in a page:
     <header class="nav" data-page="home"></header>          signed-in nav; data-page = home|explore|messages|notifications|profile|none
     <header class="nav" data-page="out"></header>           signed-out nav (Log in / Sign up)
     <nav class="tabs" data-page="home"></nav>               phone tab bar (signed in only)
     <script src="circles.js"></script>                      at the end of <body>
   Map:
     Circles.drawMap(canvasEl, [{ x: .3, y: .3, r: 90, temp: 1 }, …], { exact: [{x,y}] })
     x/y are fractions of the canvas, r in px, temp 0..1 (hotter = sooner/more active).
     exact: optional exact pins (members only), drawn as a small ink dot with a ring. */
(function () {
  // Apply a saved theme early (pages also inline this in <head> to avoid a flash).
  try { const t = localStorage.getItem("circles-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  const LOGO = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <circle class="ring" cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" pathLength="50" stroke-dasharray="6.4 3.6"/>
    <circle cx="10" cy="10" r="3" fill="currentColor"/></svg>`;
  const SUN = `<svg class="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
  const MOON = `<svg class="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`;
  const BELL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`;
  const themeBtn = `<button class="icon-btn theme" type="button" aria-label="Switch theme">${SUN}${MOON}</button>`;

  const cur = (p, k) => (p === k ? ' aria-current="page"' : "");
  document.querySelectorAll("header.nav").forEach(h => {
    const p = h.dataset.page || "none";
    if (p === "out") {
      h.innerHTML = `<div class="nav-inner glass nav-out">
        <a class="mark" href="index.html">${LOGO}Circles</a>
        <nav class="links" aria-label="Main"><a href="explore.html">Explore</a></nav>
        <div class="end">${themeBtn}<a href="login.html">Log in</a><a class="btn" href="signup.html">Sign up</a></div></div>`;
    } else {
      h.innerHTML = `<div class="nav-inner glass">
        <a class="mark" href="home.html">${LOGO}Circles</a>
        <nav class="links" aria-label="Main">
          <a href="home.html"${cur(p, "home")}>Home</a>
          <a href="explore.html"${cur(p, "explore")}>Explore</a>
          <a href="messages.html"${cur(p, "messages")}>Messages</a>
        </nav>
        <div class="end">${themeBtn}
          <a class="icon-btn" href="notifications.html" aria-label="Notifications, 2 new"${cur(p, "notifications")}>${BELL}<span class="badge"></span></a>
          <a class="me" href="profile.html" aria-label="Your profile">BB</a>
        </div></div>`;
    }
  });
  document.querySelectorAll("nav.tabs").forEach(t => {
    const p = t.dataset.page;
    t.classList.add("glass"); t.setAttribute("aria-label", "Main");
    t.innerHTML = `<a href="home.html"${cur(p, "home")}>Home</a><a href="explore.html"${cur(p, "explore")}>Explore</a><a href="messages.html"${cur(p, "messages")}>Messages</a><a href="profile.html"${cur(p, "profile")}>You</a>`;
  });

  /* ---------- theme: follows the system until you choose ---------- */
  const sysDark = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (document.documentElement.dataset.theme || (sysDark.matches ? "dark" : "light")) === "dark";
  const maps = [];
  function syncTheme() {
    document.querySelectorAll(".theme").forEach(b => b.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode"));
  }
  document.addEventListener("click", e => {
    if (!e.target.closest(".theme")) return;
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("circles-theme", next); } catch (err) {}
    syncTheme(); maps.forEach(m => m.redraw());
  });
  sysDark.addEventListener("change", () => { syncTheme(); maps.forEach(m => m.redraw()); });
  syncTheme();

  /* ---------- map ---------- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  function drawMap(canvas, areas, opts = {}) {
    let start = null;
    function paint(now) {
      const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
      const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = w * dpr; canvas.height = h * dpr; }
      const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = v("--cool"); g.fillRect(0, 0, w, h);

      const r = rng(opts.seed || 7), span = Math.max(w, h) * 1.1;
      g.save(); g.translate(w / 2, h * 0.42); g.rotate(-0.16);
      g.fillStyle = v("--water");
      g.beginPath(); g.moveTo(span * 0.42, -span); g.bezierCurveTo(span * 0.3, -60, span * 0.5, 80, span * 0.36, span); g.lineTo(span, span); g.lineTo(span, -span); g.fill();
      g.fillStyle = v("--cool-2");
      [[-150, -40, 150, 96], [210, 60, 92, 120], [-520, 70, 120, 80]].forEach(([x, y, pw, ph]) => { g.beginPath(); g.roundRect(x, y, pw, ph, 6); g.fill(); });
      g.strokeStyle = v("--cool-line"); g.lineCap = "round";
      for (let x = -span; x < span; x += 46) { if (r() < 0.12) continue; g.lineWidth = r() < 0.18 ? 7 : 3.5; g.beginPath(); g.moveTo(x, -span); g.lineTo(x, span); g.stroke(); }
      for (let y = -span; y < span; y += 38) { if (r() < 0.12) continue; g.lineWidth = r() < 0.18 ? 7 : 3.5; g.beginPath(); g.moveTo(-span, y); g.lineTo(span, y); g.stroke(); }
      g.lineWidth = 10; g.beginPath(); g.moveTo(-span, span * 0.35); g.lineTo(span, -span * 0.5); g.stroke();
      g.restore();

      // Each area is an isotherm: warm at the centre, cooling to nothing at the edge.
      // It settles in on load, then breathes slowly; hotter areas breathe deeper.
      const heat = v("--heat");
      if (start === null) start = now;
      const t = (now - start) / 1000;
      areas.forEach((a, i) => {
        const p = reduce ? 1 : Math.max(0, Math.min(1, (t / 1.1) * 1.6 - i * 0.25));
        const e = 1 - Math.pow(1 - p, 3);
        const breath = reduce ? 1 : 1 + 0.18 * a.temp * Math.sin((t * 2 * Math.PI) / 8 + i * 1.3);
        const x = a.x * w, y = a.y * h, rad = a.r * (0.96 + 0.04 * breath);
        const k = a.temp * e * breath;
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, hexA(heat, Math.min(1, 0.75 * k)));
        grad.addColorStop(0.45, hexA(heat, Math.min(1, 0.32 * k)));
        grad.addColorStop(1, hexA(heat, 0));
        g.fillStyle = grad; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      });
      (opts.exact || []).forEach(pt => {
        const x = pt.x * w, y = pt.y * h;
        g.fillStyle = v("--paper"); g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = v("--ink"); g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      });
    }
    // Stop for good once the canvas leaves the page (chat thumbnails come and go).
    function loop(now) { if (!canvas.isConnected) return; paint(now); if (!reduce) requestAnimationFrame(loop); }
    const m = { redraw: () => paint(performance.now()) };
    maps.push(m);
    addEventListener("resize", m.redraw);
    requestAnimationFrame(loop);
    return m;
  }

  /* Mock circles in other cities, shared by Explore and the assistant.
     [name, neighbourhood, category, days (0 = Sun), members] */
  const places = {
    Oakland: [["Lake Merritt run club","Lake Merritt","Sports",[2,6],38],["Temescal pottery night","Temescal","Arts & Culture",[3],14],["Rockridge board games","Rockridge","Social",[5],22],["Fruitvale salsa","Fruitvale","Music",[4],41]],
    Brooklyn: [["Prospect Park running club","Park Slope","Sports",[0,3],64],["Greenpoint sketch club","Greenpoint","Arts & Culture",[2],19],["Bed-Stuy chess","Bed-Stuy","Social",[4],27],["Red Hook rowing","Red Hook","Outdoors",[6],12]],
    Berkeley: [["Cheese Board regulars","North Berkeley","Food & Drink",[5],9],["Tilden trail walk","Tilden","Outdoors",[0],26],["Telegraph jazz jam","Southside","Music",[1],17]],
    Austin: [["Zilker Saturday run","Zilker","Sports",[6],48],["East Austin chess","East Cesar Chavez","Social",[4],21],["Barton Springs swim crew","Barton Hills","Outdoors",[0,3],33]],
    Chicago: [["Lakefront run club","Lincoln Park","Sports",[6],71],["Logan Square chess","Logan Square","Social",[4],25],["Pilsen print shop","Pilsen","Arts & Culture",[2],11]],
    "Los Angeles": [["Griffith Park hikers","Los Feliz","Outdoors",[0],58],["Echo Park chess","Echo Park","Social",[4],19],["Venice pickup volleyball","Venice","Sports",[6],44]]
  };

  window.Circles = { drawMap, places };

  // The in-app assistant rides along on every signed-in page.
  const page = document.querySelector("header.nav")?.dataset.page;
  if (page && page !== "out" && page !== "none") {
    const sc = document.createElement("script"); sc.src = "assistant.js"; document.body.appendChild(sc);
  }
})();
