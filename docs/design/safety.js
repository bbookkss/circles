/* Report and block dialogs for the people pages (thread, person, followers).
   Usage: <button data-report="person|post|comment|circle">Report</button>
          <button data-block="Maya Ortiz">Block</button>
   Fires a "circles:blocked" event on document after a block is confirmed. */
(function () {
  const css = `
  .dlg-back { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
    padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
    background: color-mix(in srgb, var(--ink) 28%, transparent); }
  .dlg { width: 100%; max-width: 400px; background: var(--paper); border-radius: 24px; padding: 24px;
    box-shadow: 0 24px 60px var(--shade), 0 0 0 1px var(--rule); display: grid; gap: 16px; }
  .dlg-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .dlg-title { font-size: 22px; font-weight: 400; letter-spacing: -0.02em; margin: 0; }
  .dlg fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 2px; }
  .dlg legend { font-size: 14px; color: var(--quiet); margin-bottom: 8px; }
  .dlg .opt { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 12px; border-radius: 12px; cursor: pointer; font-size: 15px; }
  .dlg .opt:hover { background: var(--cool); }
  .dlg .opt input { accent-color: var(--ink); width: 16px; height: 16px; margin: 0; }
  .dlg textarea { width: 100%; font: inherit; font-size: 15px; color: var(--ink); background: var(--cool); border: 1px solid transparent; border-radius: 14px; padding: 12px 14px; min-height: 84px; resize: vertical; }
  .dlg textarea:focus { outline: none; border-color: var(--cool-2); background: var(--paper); }
  .dlg-acts { display: flex; justify-content: flex-end; gap: 8px; }
  .btn.danger-fill { background: var(--danger); color: var(--paper); }
  .text-btn { border: 0; background: none; padding: 4px 2px; cursor: pointer; font-size: 14px; color: var(--quiet); }
  .text-btn:hover { color: var(--ink); }
  .text-btn.warn:hover { color: var(--danger); }
  @media (max-width: 640px) { .dlg-back { align-items: flex-end; } }
  @media (prefers-reduced-motion: no-preference) {
    .dlg { animation: dlg-in .22s cubic-bezier(.2,.7,.2,1) both; }
    @keyframes dlg-in { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
  }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const NOUN = { person: "this person", post: "this post", comment: "this comment", circle: "this circle" };
  const REASONS = ["Harassment or bullying", "Spam or scam", "Hate speech", "Sexual content", "Violence or threats", "Something else"];
  let lastFocus = null;

  function open(html, label) {
    lastFocus = document.activeElement;
    const back = document.createElement("div");
    back.className = "dlg-back";
    back.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-label="${label}">${html}</div>`;
    back.addEventListener("click", e => { if (e.target === back) close(back); });
    back.addEventListener("keydown", e => { if (e.key === "Escape") close(back); });
    document.body.appendChild(back);
    (back.querySelector("input, button.btn, textarea") || back.querySelector("button"))?.focus();
    return back;
  }
  function close(back) { back.remove(); lastFocus?.focus(); }

  function report(type) {
    const back = open(`
      <form class="dlg-form" style="display:grid;gap:16px">
        <div class="dlg-head"><p class="dlg-title">Report ${NOUN[type]}</p><button type="button" class="text-btn" data-x>Close</button></div>
        <fieldset><legend>What's wrong with it?</legend>
          ${REASONS.map((r, i) => `<label class="opt"><input type="radio" name="reason" value="${i}">${r}</label>`).join("")}
        </fieldset>
        <label class="sr" for="rep-details">More detail</label>
        <textarea id="rep-details" placeholder="Anything that would help (optional)" maxlength="2000"></textarea>
        <div class="dlg-acts"><button class="btn" type="submit" disabled>Send report</button></div>
      </form>`, `Report ${NOUN[type]}`);
    const f = back.querySelector("form"), send = f.querySelector('[type="submit"]');
    back.querySelector("[data-x]").onclick = () => close(back);
    f.addEventListener("change", () => send.disabled = !f.reason.value);
    f.addEventListener("submit", e => {
      e.preventDefault(); if (!f.reason.value) return;
      back.querySelector(".dlg").innerHTML = `
        <p class="dlg-title">Report sent</p>
        <p>It's with the Circles team for review. Nobody is told who reported it.</p>
        ${type !== "circle" ? `<p class="quiet small">If you don't want to hear from them at all, you can also block them.</p>` : ""}
        <div class="dlg-acts"><button class="btn" type="button" data-x>Done</button></div>`;
      const d = back.querySelector("[data-x]"); d.onclick = () => close(back); d.focus();
    });
  }

  function block(name) {
    const first = name.split(" ")[0];
    const back = open(`
      <p class="dlg-title">Block ${name}?</p>
      <p>Neither of you will be able to message or follow the other, and you'll stop seeing each other's posts and comments. ${first} isn't told. You both stay in any circle you share.</p>
      <div class="dlg-acts"><button class="btn ghost" type="button" data-x>Cancel</button><button class="btn danger-fill" type="button" data-ok>Block</button></div>`, `Block ${name}`);
    back.querySelector("[data-x]").onclick = () => close(back);
    back.querySelector("[data-ok]").onclick = () => { close(back); document.dispatchEvent(new CustomEvent("circles:blocked", { detail: { name } })); };
  }

  document.addEventListener("click", e => {
    const r = e.target.closest("[data-report]"); if (r) { report(r.dataset.report); return; }
    const b = e.target.closest("[data-block]"); if (b) block(b.dataset.block);
  });
})();
