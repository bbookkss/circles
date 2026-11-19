/* "Ask Circles": the in-app assistant, mocked.
   Loaded by circles.js on every signed-in page. The brain here is keyword rules
   with conversation state, standing in for Claude Sonnet 5.5 with tools that run
   as the signed-in user (RLS applies):

     my_week            upcoming meets, check-in state, who's going
     propose_rsvp       never writes. It lays out one card per meet with its own
                        Going / Maybe / Can't go buttons, the suggested answer
                        marked. The person taps each one; nothing is sent for
                        them. If check-in isn't open yet, a tap schedules it.
     my_messages        recent and unread messages, by person
     search_circles     by activity, near the user or in a named place
     go_to_place        client action: move the Explore map

   Every circle it mentions gets a thumbnail map: an exact dot for circles you're
   in, an area for the rest, as everywhere else in the app.

   Suggested prompts are worked out from the person's week and inbox (no model
   call), shown when the panel opens and refreshed after every reply.

   RSVPs persist in localStorage ("circles-rsvp"), so Home shows what you said here. */
(function () {
  const page = document.querySelector("header.nav")?.dataset.page;
  if (!page || page === "out" || page === "none") return;

  const RING = `<svg class="ask-ring" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
    <circle class="ring" cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" pathLength="50" stroke-dasharray="6.4 3.6"/>
    <circle cx="10" cy="10" r="3" fill="currentColor"/></svg>`;

  const css = document.createElement("style");
  css.textContent = `
  .ask-btn { position: fixed; z-index: 6; right: max(20px, env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    display: inline-flex; align-items: center; gap: 9px; padding: 12px 18px 12px 14px; border-radius: 999px; cursor: pointer;
    font: inherit; font-size: 15px; font-weight: 500; color: var(--ink); }
  .ask-btn[aria-expanded="true"] { display: none; }
  .ask-panel { position: fixed; z-index: 7; right: max(20px, env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    width: min(440px, calc(100vw - 40px)); height: min(660px, calc(100vh - 110px)); border-radius: 26px;
    display: flex; flex-direction: column; overflow: hidden; }
  .ask-head { display: flex; align-items: center; gap: 10px; padding: 16px 14px 12px 20px; font-weight: 500; }
  .ask-head .x { margin-left: auto; }
  .ask-panel.busy .ask-head .ring { animation-duration: 2.4s; }
  .ask-log { flex: 1; overflow-y: auto; padding: 4px 20px 16px; display: flex; flex-direction: column; gap: 14px; overscroll-behavior: contain; }
  .ask-intro { color: var(--quiet); font-size: 15px; }
  .ask-sugs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .ask-sugs button, .ask-acts button { border: 0; cursor: pointer; font: inherit; font-size: 14px; padding: 8px 13px; border-radius: 999px; background: var(--cool); color: var(--ink); text-align: left; }
  .ask-sugs button:hover, .ask-acts button:hover { background: var(--cool-2); }
  .ask-acts button.go { background: var(--heat); color: var(--on-heat); }
  .ask-acts button.go:hover { filter: brightness(1.04); background: var(--heat); }
  .ask-me { align-self: flex-end; max-width: 85%; background: var(--ink); color: var(--paper); padding: 9px 14px; border-radius: 18px 18px 6px 18px; font-size: 15px; }
  .ask-ai { max-width: 100%; font-size: 15px; }
  .ask-ai > p + p, .ask-ai > .ask-rows + p { margin-top: 10px; }
  .ask-step { font-size: 14px; color: var(--quiet); display: flex; align-items: center; gap: 8px; }
  .ask-step::before { content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--quiet); opacity: .6; }
  .ask-step.live::before { animation: blink 1s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: .15; } }
  .ask-rows { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 6px; }
  .ask-rows a { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px; align-items: center; padding: 8px 12px 8px 8px; border-radius: 16px; background: var(--cool); }
  .ask-rows a:hover { background: var(--cool-2); }
  .ask-rows .thumb { position: relative; width: 64px; height: 56px; border-radius: 11px; overflow: hidden; }
  .ask-rows .thumb canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .ask-rows b { font-weight: 500; display: block; line-height: 1.3; }
  .ask-rows .sub { display: block; font-size: 13px; color: var(--quiet); margin-top: 2px; }
  .ask-rows .hot { color: var(--heat-ink); font-weight: 500; }
  .ask-rows .st { display: inline-block; font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: 999px; background: var(--paper); color: var(--ink); margin-top: 5px; }
  .ask-rows .st.yes { background: var(--heat); color: var(--on-heat); }
  .ask-rows li.card { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px; padding: 10px 12px 12px 8px; border-radius: 16px; background: var(--cool); }
  .ask-rows li.card .thumb { align-self: start; margin-top: 2px; }
  .ask-rows li.card a.nm { display: inline; padding: 0; background: none; border-radius: 0; font-weight: 500; }
  .ask-rows li.card a.nm:hover { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
  .chip-st { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 3px 9px; border-radius: 999px; margin-top: 8px; background: var(--paper); color: var(--quiet); }
  .chip-st.sent { background: var(--ink); color: var(--paper); }
  .chip-st.sched { background: var(--cool-2); color: var(--ink); }
  .chip-st.sugg { background: transparent; border: 1px dashed var(--quiet); color: var(--ink); }
  .chip-st svg { flex: none; }
  .pick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
  .pick button { border: 1px solid transparent; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; padding: 6px 11px; border-radius: 999px; background: var(--paper); color: var(--ink); }
  .pick button:hover { border-color: var(--cool-2); }
  .pick button.sugg { border: 1px dashed var(--ink); }
  .pick button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .pick button[aria-pressed="true"][data-s="yes"] { background: var(--heat); color: var(--on-heat); border-color: var(--heat); }
  .pick .undo { background: none; padding: 6px 4px; color: var(--quiet); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
  .pick .undo:hover { color: var(--ink); border-color: transparent; }
  .pick .note { font-size: 12px; color: var(--quiet); flex-basis: 100%; }
  .msg { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 10px; padding: 10px 12px; border-radius: 16px; background: var(--cool); }
  .msg .who { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; font-size: 14px; }
  .msg .who b { font-weight: 500; }
  .msg .who span { color: var(--quiet); font-size: 13px; }
  .msg .who .new { color: var(--heat-ink); font-weight: 500; }
  .msg p { margin-top: 3px; font-size: 14px; }
  .ask-rows .msg a { display: inline-block; padding: 0; background: none; border-radius: 0; font-size: 13px; margin-top: 6px; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; text-decoration-color: var(--cool-2); }
  .ask-next { display: flex; flex-wrap: wrap; gap: 8px; }
  .ask-next button { border: 0; cursor: pointer; font: inherit; font-size: 13px; padding: 7px 12px; border-radius: 999px; background: var(--paper); color: var(--ink); box-shadow: 0 0 0 1px var(--cool-2) inset; }
  .ask-next button:hover { background: var(--cool); }
  .ask-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
  .ask-done { font-size: 13px; color: var(--quiet); }
  .ask-form { display: flex; gap: 8px; padding: 10px; margin: 0 10px 10px; border-radius: 20px; background: var(--paper); align-items: center; }
  .ask-form input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 16px; color: var(--ink); padding: 6px 8px; }
  .ask-form input:focus { outline: none; }
  .ask-form input::placeholder { color: var(--quiet); }
  @media (max-width: 640px) {
    .ask-btn { bottom: calc(84px + env(safe-area-inset-bottom, 0px)); right: 16px; padding: 12px; }
    .ask-btn .lbl { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .ask-panel { inset: auto 8px calc(8px + env(safe-area-inset-bottom, 0px)) 8px; width: auto; height: min(80vh, 680px); }
  }
  @media (prefers-reduced-motion: reduce) { .ask-step.live::before { animation: none; } }`;
  document.head.appendChild(css);

  document.body.insertAdjacentHTML("beforeend", `
    <button class="ask-btn glass" type="button" id="askBtn" aria-expanded="false" aria-controls="askPanel">${RING}<span class="lbl">Ask Circles</span></button>
    <section class="ask-panel glass" id="askPanel" role="dialog" aria-label="Ask Circles" hidden>
      <div class="ask-head">${RING}Ask Circles
        <button class="icon-btn x" type="button" id="askClose" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="ask-log" id="askLog" aria-live="polite">
        <div class="ask-intro">Ask about your week, your messages, or circles anywhere. I'll lay out the options; you choose.
          <div class="ask-sugs" id="askSugs"></div>
        </div>
      </div>
      <form class="ask-form" id="askForm">
        <label class="sr" for="askIn">Ask Circles</label>
        <input id="askIn" placeholder="Ask, or tell me what to do" autocomplete="off">
        <button class="btn sm" type="submit">Send</button>
      </form>
    </section>`);

  const btn = document.getElementById("askBtn"), panel = document.getElementById("askPanel");
  const log = document.getElementById("askLog"), input = document.getElementById("askIn");
  function open() { panel.hidden = false; btn.setAttribute("aria-expanded", "true"); refreshIntro(); input.focus(); }
  function close() { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); }
  btn.addEventListener("click", open);
  if (/(^#|&)ask\b/.test(location.hash)) open(); // home.html#ask opens the panel straight away
  document.getElementById("askClose").addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) close(); });
  log.addEventListener("click", e => {
    const s = e.target.closest(".ask-sugs button, .ask-next button"); if (s) return ask(s.textContent);
    const p = e.target.closest(".pick button[data-s]"); if (p) return answer(p);
    const u = e.target.closest(".pick .undo"); if (u) return undo(u.closest("[data-meet]").dataset.meet);
    const a = e.target.closest("[data-act]"); if (a) act(a);
  });
  document.getElementById("askForm").addEventListener("submit", e => {
    e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ""; ask(q);
  });

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a.at(-1);

  function add(html) {
    log.insertAdjacentHTML("beforeend", html);
    const el = log.lastElementChild;
    el.querySelectorAll("canvas[data-temp]").forEach(c => Circles.drawMap(c,
      [{ x: .5, y: .5, r: 30, temp: +c.dataset.temp }],
      { seed: +c.dataset.seed, exact: c.dataset.exact ? [{ x: .5, y: .5 }] : [] }));
    log.scrollTop = log.scrollHeight;
    return el;
  }
  async function step(text) {
    const el = add(`<div class="ask-step live">${text}</div>`);
    await wait(600 + Math.random() * 400);
    el.classList.remove("live");
  }

  /* ---------- your meets, and what you've said ---------- */
  const MEETS = {
    chess: { name: "Thursday chess", when: "tomorrow, 7:00 pm", short: "chess", venue: "Ritual Coffee, Valencia St",
      open: true, going: ["Maya", "Sam"], maybe: 1, seed: 3, temp: 1 },
    run: { name: "Saturday morning run", when: "Saturday, 8:30 am", short: "the run", venue: "Duboce Park steps",
      open: false, opens: "Friday morning", going: ["Priya", "Jon", "Ade", "Lena"], maybe: 0, seed: 8, temp: .7 },
    book: { name: "Book club at Dog Eared", when: "Monday, Nov 30, 7:00 pm", short: "book club", venue: "Dog Eared Books",
      open: false, opens: "Sunday the 29th", going: ["Ines"], maybe: 0, seed: 14, temp: .35 }
  };
  const THIS_WEEK = ["chess", "run"];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("circles-rsvp") || "{}") || {}; } catch (e) {}
  const rsvp = Object.assign({ chess: null, run: null, book: null }, saved); // { s: "yes"|"no"|"maybe", queued } or null
  const prevOf = {}; // for Undo: what each meet was before its last tap
  function persist() {
    try { localStorage.setItem("circles-rsvp", JSON.stringify(rsvp)); } catch (e) {}
    window.dispatchEvent(new CustomEvent("circles:rsvp", { detail: rsvp }));
  }
  const WORD = { yes: "going", no: "can't go", maybe: "maybe" };
  const LABEL = { yes: "Going", maybe: "Maybe", no: "Can't go" };
  const TICK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`;

  /* ---------- messages ---------- */
  const MESSAGES = [
    { from: "Maya Ortiz", first: "Maya", i: "MO", when: "2h ago", unread: true, about: "chess", text: "Are you coming tomorrow? I'm bringing the travel set so we can finally try a 10-minute clock." },
    { from: "Jon Park", first: "Jon", i: "JP", when: "Yesterday", unread: true, about: "run", text: "Heads up, we're starting from the steps at 8:30 sharp on Saturday. Not waiting past 8:35." },
    { from: "Priya Shah", first: "Priya", i: "PS", when: "Monday", unread: false, text: "Thanks for the book rec, halfway through already." }
  ];

  /* ---------- one card per meet, with its own buttons ----------
     The card shows exactly where things stand: not answered, a suggestion that
     hasn't been sent, sent, or scheduled. Only a tap sends anything. */
  function meetCard(id, sugg) {
    const m = MEETS[id];
    return `<li class="card" data-meet="${id}" data-sugg="${sugg || ""}">
      <span class="thumb"><canvas data-temp="${m.temp}" data-seed="${m.seed}" data-exact="1" aria-hidden="true"></canvas></span>
      <div class="body">${cardBody(id, sugg)}</div></li>`;
  }
  function cardBody(id, sugg) {
    const m = MEETS[id], r = rsvp[id];
    const win = m.open ? `<span class="hot">Check-in open.</span> ` : `Check-in opens ${m.opens}. `;
    const who = `${list(m.going.slice(0, 2))}${m.going.length > 2 ? ` and ${m.going.length - 2} more` : ""} ${m.going.length === 1 ? "is" : "are"} in.`;
    let chip;
    if (r && r.queued) chip = `<span class="chip-st sched">Scheduled: ${WORD[r.s]}. Sends ${m.opens}.</span>`;
    else if (r) chip = `<span class="chip-st sent">${TICK}Sent: ${WORD[r.s]}</span>`;
    else chip = `<span class="chip-st">Not answered</span>`;
    if (sugg && (!r || r.s !== sugg)) chip += ` <span class="chip-st sugg">Suggested: ${WORD[sugg]}. Not sent.</span>`;
    const pick = ["yes", "maybe", "no"].map(s =>
      `<button type="button" data-s="${s}" aria-pressed="${!!r && r.s === s}" class="${sugg === s && (!r || r.s !== s) ? "sugg" : ""}">${LABEL[s]}</button>`).join("");
    const undoBtn = id in prevOf ? `<button type="button" class="undo">Undo</button>` : "";
    const note = m.open ? "" : `<span class="note">Check-in isn't open yet. A tap here is saved and sent ${m.opens}.</span>`;
    return `<a class="nm" href="circle.html">${m.name}</a>, ${m.when}
      <span class="sub">${m.venue}</span><span class="sub">${win}${who}</span>
      ${chip}<div class="pick" role="group" aria-label="Your answer for ${m.name}">${pick}${undoBtn}${note}</div>`;
  }
  function refreshCards(id) {
    log.querySelectorAll(`li.card[data-meet="${id}"]`).forEach(li => {
      li.querySelector(".body").innerHTML = cardBody(id, li.dataset.sugg || null);
    });
  }
  function answer(b) {
    const li = b.closest("[data-meet]"), id = li.dataset.meet, s = b.dataset.s;
    if (rsvp[id] && rsvp[id].s === s) return; // already that
    prevOf[id] = rsvp[id] ? { ...rsvp[id] } : null;
    rsvp[id] = { s, queued: !MEETS[id].open };
    persist(); refreshCards(id); refreshNext();
    log.querySelector(`li.card[data-meet="${id}"] .pick button[data-s="${s}"]`)?.focus();
  }
  function undo(id) {
    rsvp[id] = prevOf[id]; delete prevOf[id];
    persist(); refreshCards(id); refreshNext();
  }

  function placeRow([name, hood, cat, days, members], i, href) {
    return `<li><a href="${href}"><span class="thumb"><canvas data-temp="${Math.min(1, .35 + members / 80)}" data-seed="${(name.length * 37 + i) % 997 + 1}" aria-hidden="true"></canvas></span>
      <span><b>${name}</b><span class="sub">${hood}, ${list(days.map(d => DAYS[d]))}</span><span class="sub">${cat}, ${members} members</span></span></a></li>`;
  }
  function msgRow(m) {
    return `<li class="msg"><span class="av" aria-hidden="true">${m.i}</span><div>
      <div class="who"><b>${m.from}</b><span>${m.when}</span>${m.unread ? `<span class="new">New</span>` : ""}</div>
      <p>${esc(m.text)}</p><a href="thread.html">Open conversation</a></div></li>`;
  }

  /* ---------- suggestions, from the person's own week and inbox ---------- */
  function suggestions(skip) {
    const out = [];
    const unreadFrom = MESSAGES.filter(m => m.unread);
    if (THIS_WEEK.some(id => MEETS[id].open && !rsvp[id])) out.push("Am I going to chess tomorrow?");
    if (unreadFrom.length === 1) out.push(`Read ${unreadFrom[0].first}'s message`);
    else if (unreadFrom.length > 1) out.push(`Read my ${unreadFrom.length} new messages`);
    if (!rsvp.run) out.push("Who's going to the run Saturday?");
    if (out.length < 4) out.push("What's on this week?");
    if (out.length < 4) out.push("Find something for Sunday");
    if (out.length < 4) out.push("Show me Oakland");
    return out.filter(s => s !== skip).slice(0, 4);
  }
  function refreshIntro() {
    const el = document.getElementById("askSugs");
    if (el) el.innerHTML = suggestions().map(s => `<button type="button">${s}</button>`).join("");
  }
  let lastAsked = "";
  function refreshNext() {
    log.querySelectorAll(".ask-next").forEach(n => n.remove());
    if (log.querySelector(".ask-intro")) return;
    const next = suggestions(lastAsked).slice(0, 3);
    if (next.length) { log.insertAdjacentHTML("beforeend", `<div class="ask-next" aria-label="Suggestions">${next.map(s => `<button type="button">${s}</button>`).join("")}</div>`); log.scrollTop = log.scrollHeight; }
  }

  /* ---------- conversation state ---------- */
  const state = { last: [], awaiting: null };

  const NEAR = [
    ["Mission pickup basketball", "Mission", "Sports", [2, 4], 56, "basketball hoops pickup ball"],
    ["Bernal Hill sunset walk", "Bernal Heights", "Outdoors", [0, 3], 31, "walk walking hike hikes outdoors sunset sunday"],
    ["Castro choir", "Castro", "Music", [1], 18, "sing singing choir music"],
    ["Glen Canyon trail crew", "Glen Park", "Outdoors", [0], 15, "trail hike hikes hiking outdoors sunday"],
    ["Front-end meetup", "SoMa", "Tech", [3], 43, "code coding tech programming developers"],
    ["Tartine bread class", "Mission", "Food & Drink", [6], 12, "bread baking food cooking class"],
    ["Lake Merced run club", "Lakeshore", "Sports", [6], 29, "run running runners jog jogging"]
  ];
  const PLACES = Object.keys(Circles.places);
  const ALIASES = { la: "Los Angeles", nyc: "Brooklyn", "new york": "Brooklyn", sf: "San Francisco", "san francisco": "San Francisco" };
  function placeIn(q) {
    const l = q.toLowerCase();
    const p = PLACES.find(p => l.includes(p.toLowerCase()));
    if (p) return p;
    const a = Object.keys(ALIASES).find(k => new RegExp(`\\b${k}\\b`).test(l));
    return a ? ALIASES[a] : null;
  }

  const statusOf = l =>
    /\b(maybe|might|not sure|possibly|tentative)\b/.test(l) ? "maybe" :
    /\b(no|not going|can'?t|cannot|won'?t|skip|out of town|away|miss|decline|busy|bail|pass)\b/.test(l) ? "no" :
    /\b(yes|i'?m going|i am going|i'?m in|count me in|attend|be there|i'?ll come|sign me up)\b/.test(l) ? "yes" : null;

  function targetsOf(l) {
    const t = [];
    if (/chess/.test(l)) t.push("chess");
    if (/\brun\b|running|saturday|weekend/.test(l)) t.push("run");
    if (/book|dog eared|monday/.test(l)) t.push("book");
    if (!t.length && /\b(both|all|everything|this week|them|those)\b/.test(l)) return state.last.length > 1 ? state.last.slice() : THIS_WEEK.slice();
    if (!t.length && /\b(it|that one|that)\b/.test(l) && state.last.length === 1) return state.last.slice();
    return t;
  }
  const travelling = l => /out of town|away|travel|travell?ing|trip|visiting|vacation|holiday|won'?t be (around|here|home)/.test(l);

  async function ask(q) {
    log.querySelector(".ask-intro")?.remove();
    log.querySelectorAll(".ask-next").forEach(n => n.remove());
    lastAsked = q;
    add(`<div class="ask-me">${esc(q)}</div>`);
    panel.classList.add("busy");
    try { await route(q); } finally { panel.classList.remove("busy"); refreshNext(); }
  }

  async function route(q) {
    const l = q.toLowerCase(), place = placeIn(q);

    if (state.awaiting === "where") {
      state.awaiting = null;
      const p = place || q.replace(/^(i'?ll be in|i'?m going to|i'?m in|in|to|going to|headed to|heading to)\s+/i, "").replace(/[.!?]$/, "").trim();
      return showPlace(p.charAt(0).toUpperCase() + p.slice(1), true);
    }

    if (/message|messages|inbox|\bdms?\b|texted|wrote|hear from|said to me/.test(l)) return messages(l);
    if (/who'?s (going|coming)|who is (going|coming)/.test(l)) return whosGoing(targetsOf(l)[0] || "chess");
    if (/am i going|am i in|did i (answer|rsvp)|rsvp|respond|answer|check (me )?in/.test(l) && targetsOf(l).length) return propose(targetsOf(l), null, false);

    const s = statusOf(l), travel = travelling(l);
    if (travel && place && !/\b(say|mark|rsvp|no to|can'?t)\b/.test(l)) return showPlace(place, true);
    if (s && !/\b(find|search|look for)\b/.test(l)) {
      const t = targetsOf(l);
      return propose(t.length ? t : THIS_WEEK.slice(), s, travel && !place);
    }

    if (/coming up|docket|this week|my week|schedule|what'?s on|what do i have|agenda|plans/.test(l)) return docket();
    if (place && /\b(i'?ll be|i'?m going|heading|headed|visiting)\b/.test(l)) return showPlace(place, true);
    if (place && (/take me|go to|show me|move|look at|over to|open|map/.test(l) || l.split(/\s+/).length <= 3)) return goTo(place);
    if (/find|looking for|any |is there|search|want to|where can|something to do|things to do/.test(l)) return find(q, place);
    if (place) return showPlace(place, false);
    return help();
  }

  async function docket() {
    await step("Checking your circles for the next two weeks");
    state.last = THIS_WEEK.slice();
    const unanswered = THIS_WEEK.filter(id => !rsvp[id]);
    add(`<div class="ask-ai"><p>Two meets this week${unanswered.length ? `. ${unanswered.length === 1 ? "One is" : "Both are"} still unanswered` : ""}. Answer each one below when you're ready.</p>
      <ul class="ask-rows">${THIS_WEEK.map(id => meetCard(id)).join("")}</ul>
      <p>After that, book club on Monday, Nov 30.</p></div>`);
  }

  async function whosGoing(id) {
    const m = MEETS[id];
    await step(`Looking up check-ins for ${m.name}`);
    state.last = [id];
    add(`<div class="ask-ai"><p>For ${m.name} ${m.when}: ${list(m.going)} ${m.going.length === 1 ? "is" : "are"} going${m.maybe ? `, and ${m.maybe} said maybe` : ""}.</p>
      <ul class="ask-rows">${meetCard(id)}</ul></div>`);
  }

  /* I never answer for you. I lay out each meet with my suggestion marked, and
     you tap the answer you want on each one. */
  async function propose(ids, s, askWhere) {
    await step(`Looking up ${list(ids.map(id => MEETS[id].name))}`);
    state.last = ids.slice();
    const lead = s
      ? `Here's what I'd suggest, marked with a dashed outline. Nothing is sent until you tap an answer on each one.`
      : `Here's where ${ids.length > 1 ? "they stand" : "it stands"}. Tap an answer to send it.`;
    add(`<div class="ask-ai"><p>${lead}</p><ul class="ask-rows">${ids.map(id => meetCard(id, s)).join("")}</ul></div>`);
    if (askWhere) {
      await wait(400);
      state.awaiting = "where";
      add(`<div class="ask-ai"><p>Where will you be? I can look for circles there that meet while you're away.</p>
        <div class="ask-acts">${["Brooklyn", "Austin", "Los Angeles"].map(p => `<button type="button" data-act="where" data-p="${p}">${p}</button>`).join("")}<button type="button" data-act="nowhere">Not looking</button></div></div>`);
    }
  }

  async function messages(l) {
    const who = MESSAGES.find(m => l.includes(m.first.toLowerCase()));
    await step(who ? `Opening your messages from ${who.first}` : "Checking your messages");
    const shown = who ? [who] : (/new|unread/.test(l) ? MESSAGES.filter(m => m.unread) : MESSAGES);
    const unread = shown.filter(m => m.unread).length;
    const lead = who ? `${who.first} wrote ${who.when.toLowerCase()}:` : unread ? `${unread} new message${unread === 1 ? "" : "s"}${shown.length > unread ? ", and one you've read" : ""}:` : "No new messages. Here's the latest:";
    add(`<div class="ask-ai"><p>${lead}</p><ul class="ask-rows">${shown.map(msgRow).join("")}</ul></div>`);
    shown.forEach(m => m.unread = false);
    // If a message is about a meet you haven't answered, put that meet next to it.
    const about = [...new Set(shown.map(m => m.about).filter(id => id && !rsvp[id]))];
    if (about.length) {
      state.last = about;
      add(`<div class="ask-ai"><p>${about.length === 1 ? "That's about" : "Those are about"} ${list(about.map(id => MEETS[id].name))}, which you haven't answered:</p>
        <ul class="ask-rows">${about.map(id => meetCard(id)).join("")}</ul></div>`);
    }
  }

  async function showPlace(place, away) {
    if (place === "San Francisco") return docket();
    await step(`Searching circles in ${esc(place)}`);
    const found = Circles.places[place];
    if (!found) {
      return add(`<div class="ask-ai"><p>No circles in ${esc(place)} yet. If you start one there, people who search for it will find yours.</p>
        <div class="ask-acts"><a class="btn sm ghost" href="circle-new.html">Start a circle</a></div></div>`);
    }
    const href = `explore.html#place=${encodeURIComponent(place)}`;
    add(`<div class="ask-ai"><p>${found.length} circles in ${place}${away ? " that meet while you're there" : ""}. They show as areas until you join one.</p>
      <ul class="ask-rows">${found.map((c, i) => placeRow(c, i, href)).join("")}</ul>
      <div class="ask-acts"><button type="button" data-act="goto" data-p="${place}">Open ${place} on the map</button></div></div>`);
  }

  async function goTo(place) {
    await step(`Finding ${esc(place)} on the map`);
    const onExplore = page === "explore";
    add(`<div class="ask-ai"><p>${onExplore ? `Moved the map to ${place}.` : `Opening Explore in ${place}.`}</p></div>`);
    await wait(450);
    if (onExplore) window.dispatchEvent(new CustomEvent("circles:goto", { detail: { place } }));
    else location.href = `explore.html#place=${encodeURIComponent(place)}&ask`;
  }

  async function find(q, place) {
    if (place) return showPlace(place, false);
    const words = q.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/)
      .filter(w => w.length > 2 && !/^(find|looking|for|any|there|search|want|where|can|near|the|and|with|some|join|group|club|circle|circles|something)$/.test(w));
    await step(`Searching circles near you for "${esc(words.join(" ") || q)}"`);
    const hits = NEAR.filter(c => words.some(w => c[5].includes(w) || c[0].toLowerCase().includes(w))).slice(0, 3);
    if (!hits.length) {
      return add(`<div class="ask-ai"><p>Nothing for that near you yet. You could start the first one.</p>
        <div class="ask-acts"><a class="btn sm ghost" href="circle-new.html">Start a circle</a></div></div>`);
    }
    add(`<div class="ask-ai"><p>${hits.length === 1 ? "One circle" : hits.length + " circles"} near you:</p>
      <ul class="ask-rows">${hits.map((c, i) => placeRow(c, i, "circle.html")).join("")}</ul>
      <div class="ask-acts"><button type="button" data-act="explore">Show them on the map</button></div></div>`);
  }

  async function help() {
    await step("Thinking");
    add(`<div class="ask-ai"><p>I can show your week and who's going, pull up messages, find circles, and move the map to another city. When something needs an answer, I'll lay out the choices for you to make.</p></div>`);
  }

  async function busy(fn) { panel.classList.add("busy"); try { await fn(); } finally { panel.classList.remove("busy"); refreshNext(); } }

  async function act(el) {
    const kind = el.dataset.act, row = el.closest(".ask-acts");
    const done = text => { row.innerHTML = `<span class="ask-done">${esc(text)}</span>`; };
    if (kind === "where") { const p = el.dataset.p; done(el.textContent); state.awaiting = null; await busy(() => showPlace(p, true)); }
    else if (kind === "nowhere") { done("Not looking"); state.awaiting = null; add(`<div class="ask-ai"><p>Have a good trip.</p></div>`); refreshNext(); }
    else if (kind === "goto") { const p = el.dataset.p; await busy(() => goTo(p)); }
    else if (kind === "explore") location.href = "explore.html";
  }

  refreshIntro();
})();
