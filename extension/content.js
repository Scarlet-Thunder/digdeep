// DigDeep content script
// Apple "Liquid Glass" look: frosted glass, light-catching edges, spring motion,
// and a soft cursor highlight that follows the mouse fluidly and wraps around buttons.

const MOCK = false; // true = fake answer, for testing the UI without the background script
const MOCK_RESULT = { title: "Octopus", fact: "Octopuses have three hearts and blue blood.", source: "Wikipedia" };

const CURSOR_HIGHLIGHT = true; // the soft glass circle that follows your mouse
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const SPRING = "cubic-bezier(.3,1.3,.5,1)"; // slight overshoot, like iOS
const EASE = "cubic-bezier(.22,1,.36,1)";   // smooth settle

const ICON_SEARCH =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>';
const ICON_CLOSE =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5"/></svg>';

const STYLE = `
  *{box-sizing:border-box}
  button{font-family:inherit; color:inherit}
  .root{
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Segoe UI Variable","Segoe UI",system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
    --tint:rgba(255,255,255,.45);
    --edge:rgba(255,255,255,.85); --edge-dim:rgba(255,255,255,.18);
    --sheen:rgba(255,255,255,.35);
    --text:#1d1d1f; --sub:rgba(60,60,67,.62);
    --fill:rgba(120,120,128,.14); --fill-2:rgba(120,120,128,.24);
    --accent:#007aff;
    --shadow:0 14px 44px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.06);
    --ptr:rgba(120,120,128,.20); --ptr-edge:rgba(255,255,255,.55);
  }
  @media (prefers-color-scheme:dark){
    .root{
      --tint:rgba(36,36,40,.45);
      --edge:rgba(255,255,255,.38); --edge-dim:rgba(255,255,255,.05);
      --sheen:rgba(255,255,255,.08);
      --text:#f5f5f7; --sub:rgba(235,235,245,.6);
      --fill:rgba(120,120,128,.24); --fill-2:rgba(120,120,128,.36);
      --accent:#0a84ff;
      --shadow:0 14px 44px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.28);
      --ptr:rgba(210,210,220,.16); --ptr-edge:rgba(255,255,255,.22);
    }
  }

  /* Liquid Glass: blurred, saturated backdrop + a light-catching edge + a soft top sheen */
  .glass{
    position:absolute; isolation:isolate; color:var(--text);
    background:var(--tint);
    -webkit-backdrop-filter:blur(24px) saturate(190%);
    backdrop-filter:blur(24px) saturate(190%);
    box-shadow:var(--shadow);
  }
  .glass::before{ /* the edge: bright at the corners where light hits, faint on the sides */
    content:""; position:absolute; inset:0; border-radius:inherit; padding:1px; pointer-events:none;
    background:linear-gradient(140deg,var(--edge),var(--edge-dim) 32%,var(--edge-dim) 68%,var(--edge));
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor; mask-composite:exclude;
  }
  .glass::after{ /* the sheen */
    content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:-1;
    background:linear-gradient(180deg,var(--sheen),transparent 42%);
  }

  /* Dig button */
  .pill{
    display:flex; align-items:center; gap:6px; padding:8px 15px 8px 12px; border:0; border-radius:999px;
    font-size:13px; font-weight:600; letter-spacing:-.01em; cursor:pointer;
    transition:transform .45s ${SPRING};
  }
  .pill svg{display:block}
  .pill:hover{transform:scale(1.05)}
  .pill:active{transform:scale(.95); transition-duration:.15s}

  /* Card */
  .card{position:absolute; width:min(340px,calc(100vw - 24px)); padding:18px; border-radius:28px; overflow:hidden}
  .close{
    position:absolute; top:12px; right:12px; width:26px; height:26px; padding:0; border:0; border-radius:50%;
    display:grid; place-items:center; background:var(--fill); color:var(--sub); cursor:pointer;
    transition:background .2s,transform .45s ${SPRING};
  }
  .close:hover{background:var(--fill-2)}
  .close:active{transform:scale(.9)}
  .eyebrow{font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--sub); margin:2px 34px 4px 0}
  h3{margin:0 34px 10px 0; font-size:20px; font-weight:700; letter-spacing:-.022em; line-height:1.2}
  .fact{margin:0; font-size:15px; line-height:1.5; letter-spacing:-.01em}
  .source{margin-top:10px; font-size:12px; color:var(--sub)}
  .msg{margin:2px 34px 0 0; font-size:14px; line-height:1.45; color:var(--sub)}

  /* Nicheness slider (iOS style: thin track, glassy capsule thumb that grows when held) */
  .niche{margin-top:16px}
  .niche-top{display:flex; justify-content:space-between; align-items:baseline; font-size:12px; color:var(--sub)}
  .niche-top b{font-weight:600; color:var(--text)}
  .niche input{
    -webkit-appearance:none; appearance:none; display:block; width:100%; height:6px; margin:12px 0 8px;
    border-radius:3px; outline:none; cursor:pointer;
    background:linear-gradient(90deg,var(--accent) var(--p,60%),var(--fill-2) var(--p,60%));
  }
  .niche input::-webkit-slider-thumb{
    -webkit-appearance:none; width:30px; height:20px; border-radius:10px;
    background:rgba(255,255,255,.96);
    box-shadow:0 2px 8px rgba(0,0,0,.22),0 0 0 .5px rgba(0,0,0,.08),inset 0 1px 0 #fff;
    transition:transform .45s ${SPRING};
  }
  .niche input:active::-webkit-slider-thumb{transform:scale(1.25)}
  .niche-ends{display:flex; justify-content:space-between; font-size:11px; color:var(--sub)}

  .actions{display:flex; gap:8px; margin-top:14px}
  .act{
    flex:1; padding:10px 0; border:0; border-radius:999px; font-size:14px; font-weight:600; cursor:pointer;
    background:var(--accent); color:#fff; transition:transform .45s ${SPRING},filter .2s;
  }
  .act:hover{filter:brightness(1.08)}
  .act:active{transform:scale(.96); transition-duration:.15s}

  /* Loading: a soft light sweeps across the text, like Apple's "thinking" text */
  .thinking{
    margin:2px 34px 0 0; font-size:15px; font-weight:600;
    background:linear-gradient(90deg,var(--sub) 35%,var(--text) 50%,var(--sub) 65%) 0 0/300% 100%;
    -webkit-background-clip:text; background-clip:text; color:transparent;
    animation:sweep 1.8s linear infinite;
  }
  .skel{position:relative; overflow:hidden; height:11px; border-radius:6px; margin-top:12px; background:var(--fill)}
  .skel::after{
    content:""; position:absolute; inset:0; transform:translate3d(-100%,0,0);
    background:linear-gradient(90deg,transparent,var(--sheen),transparent);
    animation:shimmer 1.6s ${EASE} infinite;
  }

  /* content settles in: fade, rise and un-blur */
  .in{animation:settle .55s ${EASE} backwards}

  /* Cursor highlight */
  .pointer{
    position:fixed; left:0; top:0; width:22px; height:22px; border-radius:11px; pointer-events:none;
    background:var(--ptr); box-shadow:inset 0 0 0 1px var(--ptr-edge),0 2px 10px rgba(0,0,0,.08);
    opacity:0; transition:opacity .3s, background .3s; will-change:transform,width,height;
  }
  .pointer.on{opacity:1}
  .pointer.mag{background:rgba(120,120,128,.14)}

  @keyframes sweep{from{background-position:100% 0} to{background-position:0 0}}
  @keyframes shimmer{to{transform:translate3d(100%,0,0)}}
  @keyframes settle{from{opacity:0; transform:translate3d(0,6px,0); filter:blur(4px)}}
  @media (prefers-reduced-motion:reduce){
    *{animation-duration:.01ms !important; animation-iteration-count:1 !important; transition:none !important}
  }
`;

let host = null;
let shadow = null;
let digSeq = 0;        // cancels stale responses
let pillRect = null;   // where the Dig button was, so the card can grow out of it

// Nicheness: 0 = well-known basics, 100 = obscure, specific details. Remembered across pages.
let niche = 60;
try {
  chrome.storage?.local.get("niche", (d) => {
    if (typeof d?.niche === "number") niche = d.niche;
  });
} catch (e) {}
function saveNiche(v) {
  niche = v;
  try { chrome.storage?.local.set({ niche: v }); } catch (e) {}
}
function nicheLabel(v) {
  if (v < 20) return "Basics";
  if (v < 45) return "Well-known";
  if (v < 70) return "Lesser-known";
  if (v < 90) return "Niche";
  return "Deep cut";
}

// ---------- Setup ----------
function ensureHost() {
  if (host && host.isConnected) return;
  host = document.createElement("div");
  host.style.cssText = "all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;";
  shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${STYLE}</style><div class="root"><div id="ui"></div><div id="ptr"></div></div>`;
  document.documentElement.appendChild(host);
}
const $ = (id) => shadow.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text; // textContent = safe from HTML injection
  return n;
}

// Anchors are stored in document coordinates so they survive scrolling.
function toAnchor(rect) {
  return { left: rect.left + scrollX, top: rect.top + scrollY, bottom: rect.bottom + scrollY, width: rect.width };
}
function centerAnchor() {
  return toAnchor({ left: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3, width: 0 });
}

// Fade + shrink + blur away, then remove
function vanish(node) {
  node.getAnimations().forEach((a) => a.cancel());
  node.style.pointerEvents = "none";
  node.animate(
    [{ opacity: 1, transform: "scale(1)", filter: "blur(0)" }, { opacity: 0, transform: "scale(.94)", filter: "blur(4px)" }],
    { duration: 200, easing: "ease-in", fill: "forwards" }
  ).onfinish = () => node.remove();
}

function dismiss() {
  if (!shadow) return;
  digSeq++; // ignore any in-flight result
  $("ui").querySelectorAll(".pill,.card").forEach(vanish);
}

// ---------- Dig button ----------
function showButton(anchor, text, context) {
  ensureHost();
  $("ui").querySelectorAll(".pill,.card").forEach(vanish);

  const b = el("button", "pill glass mag");
  b.innerHTML = ICON_SEARCH; // static icon only
  b.append(document.createTextNode("Dig"));
  b.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection
  b.addEventListener("click", () => dig(anchor, text, context, false));
  $("ui").appendChild(b);

  const vLeft = anchor.left - scrollX;
  const left = Math.min(Math.max(vLeft + anchor.width / 2 - b.offsetWidth / 2, 12), innerWidth - b.offsetWidth - 12);
  b.style.left = left + scrollX + "px";
  b.style.top = anchor.bottom + 10 + "px";

  b.animate(
    [
      { opacity: 0, transform: "translateY(-4px) scale(.7)", filter: "blur(6px)" },
      { opacity: 1, transform: "none", filter: "blur(0)" },
    ],
    { duration: 520, easing: SPRING }
  );
}

// ---------- Card ----------
function positionCard(card, anchor) {
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const vTop = anchor.top - scrollY;
  const vBottom = anchor.bottom - scrollY;
  const vLeft = anchor.left - scrollX;
  const left = Math.min(Math.max(vLeft + anchor.width / 2 - w / 2, 12), innerWidth - w - 12);
  let top = vBottom + 12;
  if (top + h > innerHeight - 12 && vTop - h - 12 > 12) top = vTop - h - 12; // flip above
  card.style.left = left + scrollX + "px";
  card.style.top = top + scrollY + "px";
}

// Reuses the open card, so loading → result morphs instead of re-popping
function showCard(anchor, children) {
  ensureHost();
  const ui = $("ui");
  let card = ui.querySelector(".card:not([style*='pointer-events'])");
  const existed = !!card;
  if (!card) {
    card = el("div", "card glass");
    ui.appendChild(card);
  }

  const oldH = card.offsetHeight;
  const oldTop = card.style.top;
  card.getAnimations().forEach((a) => { if (a.id === "morph") a.cancel(); });

  const close = el("button", "close mag");
  close.innerHTML = ICON_CLOSE; // static icon only
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", dismiss);

  const base = existed ? 0 : 140; // a new card: let the glass open up before the words arrive
  children.forEach((c, i) => {
    c.classList.add("in");
    c.style.animationDelay = base + i * 45 + "ms";
  });
  card.replaceChildren(close, ...children);
  positionCard(card, anchor);

  if (!existed) {
    // The card grows out of the Dig button (or out of the word), like a Dynamic Island expanding
    const cl = parseFloat(card.style.left);
    const ct = parseFloat(card.style.top);
    const from = pillRect || { left: anchor.left + anchor.width / 2 - 30, top: anchor.bottom + 10, width: 60, height: 32 };
    const sx = Math.max(from.width / card.offsetWidth, 0.05);
    const sy = Math.max(from.height / card.offsetHeight, 0.05);
    card.style.transformOrigin = "0 0";
    card.animate(
      [
        { transform: `translate(${from.left - cl}px,${from.top - ct}px) scale(${sx},${sy})`, opacity: 0.4, borderRadius: "999px" },
        { transform: "none", opacity: 1, borderRadius: "28px" },
      ],
      { duration: 620, easing: SPRING }
    );
    pillRect = null;
  } else {
    const newH = card.offsetHeight;
    const newTop = card.style.top;
    if (oldH !== newH || oldTop !== newTop) {
      const morph = card.animate(
        [{ height: oldH + "px", top: oldTop }, { height: newH + "px", top: newTop }],
        { duration: 480, easing: EASE }
      );
      morph.id = "morph";
    }
  }
}

function loadingView(text) {
  const t = el("div", "thinking", `Looking into “${text}”…`);
  const short = el("div", "skel");
  short.style.width = "60%";
  return [t, el("div", "skel"), el("div", "skel"), short];
}

// ---------- Dig ----------
function dig(anchor, text, context, again) {
  const seq = ++digSeq;
  ensureHost();

  // Remember where the Dig button was, then let it melt away as the card grows from it
  const pill = $("ui").querySelector(".pill:not([style*='pointer-events'])");
  if (pill) {
    pillRect = { left: parseFloat(pill.style.left), top: parseFloat(pill.style.top), width: pill.offsetWidth, height: pill.offsetHeight };
    pill.remove();
  }

  showCard(anchor, loadingView(text));

  const handle = (res) => {
    if (seq !== digSeq) return; // dismissed or superseded
    if (!res) return showCard(anchor, [el("div", "msg", "Couldn’t reach DigDeep. Try again.")]);
    if (res.error === "NOT_FOUND") return showCard(anchor, [el("div", "msg", `Nothing found for “${text}”. Try another term.`)]);
    if (res.error) return showCard(anchor, [el("div", "msg", "Something went wrong. Try again.")]);
    renderResult(anchor, text, context, res);
  };

  if (MOCK) {
    setTimeout(() => handle(MOCK_RESULT), 1200);
    return;
  }

  try {
    chrome.runtime.sendMessage(
      { type: "DIG", text, context, page_url: location.href, again, niche },
      (res) => handle(chrome.runtime.lastError ? null : res)
    );
  } catch (e) {
    // Happens after the extension is reloaded but the page wasn't refreshed
    showCard(anchor, [el("div", "msg", "DigDeep was updated. Refresh this page and try again.")]);
  }
}

function renderResult(anchor, text, context, r) {
  const parts = [el("div", "eyebrow", niche >= 70 ? "Deep cut" : "Fun fact"), el("h3", "", r.title || text)];
  parts.push(el("p", "fact", r.fact));
  if (r.source) parts.push(el("div", "source", `From ${r.source}`));

  // Nicheness bar: drag, let go, and the card refreshes at the new level
  const box = el("div", "niche");
  const top = el("div", "niche-top");
  const val = el("b", "", nicheLabel(niche));
  top.append(el("span", "", "Nicheness"), val);
  const bar = document.createElement("input");
  bar.type = "range";
  bar.min = "0";
  bar.max = "100";
  bar.step = "5";
  bar.value = String(niche);
  bar.setAttribute("aria-label", "Nicheness");
  bar.style.setProperty("--p", niche + "%");
  bar.addEventListener("input", () => {
    bar.style.setProperty("--p", bar.value + "%");
    val.textContent = nicheLabel(Number(bar.value));
  });
  bar.addEventListener("change", () => {
    saveNiche(Number(bar.value));
    dig(anchor, text, context, false);
  });
  const ends = el("div", "niche-ends");
  ends.append(el("span", "", "General"), el("span", "", "Niche"));
  box.append(top, bar, ends);
  parts.push(box);

  const actions = el("div", "actions");
  const again = el("button", "act mag", "Another fact");
  again.addEventListener("click", () => dig(anchor, text, context, true));
  actions.append(again);
  parts.push(actions);

  showCard(anchor, parts);
}

// ---------- Selection ----------
function readSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const text = sel.toString().trim().replace(/\s+/g, " ");
  if (text.length < 2 || text.length > 100) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const anchor = rect.width || rect.height ? toAnchor(rect) : centerAnchor();
  const context = (sel.anchorNode?.parentElement?.innerText || "").slice(0, 400);
  return { text, context, anchor };
}

const insideUI = (e) => host && e.composedPath().includes(host);

// ---------- Fluid cursor highlight ----------
// A soft glass circle chases the mouse on a spring. It stretches in the direction you move,
// and over DigDeep's buttons it morphs into a rounded highlight around the button (like iPadOS).
const ptr = {
  el: null, on: false, raf: 0, last: 0,
  x: 0, y: 0, vx: 0, vy: 0, w: 22, h: 22, r: 11, // current
  mx: 0, my: 0, mag: null,                        // mouse + button under it
};

function pointerFrame(now) {
  const dt = Math.min((now - (ptr.last || now)) / 16.67, 3) || 1;
  ptr.last = now;

  // Where it wants to be
  let tx = ptr.mx, ty = ptr.my, tw = 22, th = 22, tr = 11;
  if (ptr.mag && ptr.mag.isConnected) {
    const b = ptr.mag.getBoundingClientRect();
    const pad = 5;
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    tx = cx + (ptr.mx - cx) * 0.12; // leans a little toward the mouse
    ty = cy + (ptr.my - cy) * 0.12;
    tw = b.width + pad * 2;
    th = b.height + pad * 2;
    const br = parseFloat(getComputedStyle(ptr.mag).borderTopLeftRadius) || 0;
    tr = Math.min(br + pad, th / 2);
  }

  // Spring for position, smooth follow for size
  const k = 0.17, damp = Math.pow(0.62, dt);
  ptr.vx = (ptr.vx + (tx - ptr.x) * k * dt) * damp;
  ptr.vy = (ptr.vy + (ty - ptr.y) * k * dt) * damp;
  ptr.x += ptr.vx * dt;
  ptr.y += ptr.vy * dt;
  const a = 1 - Math.pow(0.72, dt);
  ptr.w += (tw - ptr.w) * a;
  ptr.h += (th - ptr.h) * a;
  ptr.r += (tr - ptr.r) * a;

  // Stretch along the direction of travel (only when free)
  const speed = Math.hypot(ptr.vx, ptr.vy);
  const free = !ptr.mag;
  const st = free ? Math.min(speed / 28, 0.45) : 0;
  const ang = free && st > 0.01 ? Math.atan2(ptr.vy, ptr.vx) : 0;

  const s = ptr.el.style;
  s.width = ptr.w + "px";
  s.height = ptr.h + "px";
  s.borderRadius = ptr.r + "px";
  s.transform =
    `translate3d(${ptr.x - ptr.w / 2}px,${ptr.y - ptr.h / 2}px,0) rotate(${ang}rad) scale(${1 + st},${1 - st * 0.45})`;

  const settled =
    Math.abs(tx - ptr.x) < 0.1 && Math.abs(ty - ptr.y) < 0.1 && speed < 0.05 &&
    Math.abs(tw - ptr.w) < 0.1 && Math.abs(th - ptr.h) < 0.1;
  ptr.raf = settled ? 0 : requestAnimationFrame(pointerFrame);
}

function wakePointer() {
  if (!ptr.raf) {
    ptr.last = 0;
    ptr.raf = requestAnimationFrame(pointerFrame);
  }
}

if (CURSOR_HIGHLIGHT && !REDUCED) {
  document.addEventListener(
    "mousemove",
    (e) => {
      ensureHost();
      if (!ptr.el || !ptr.el.isConnected) {
        ptr.el = el("div", "pointer");
        $("ptr").appendChild(ptr.el);
      }
      ptr.mx = e.clientX;
      ptr.my = e.clientY;
      const mag = e.composedPath().find((n) => n.classList && n.classList.contains("mag")) || null;
      if (mag !== ptr.mag) {
        ptr.mag = mag;
        ptr.el.classList.toggle("mag", !!mag);
      }
      if (!ptr.on) {
        ptr.on = true;
        ptr.x = ptr.mx;
        ptr.y = ptr.my;
        ptr.el.classList.add("on");
      }
      wakePointer();
    },
    { passive: true }
  );
  document.documentElement.addEventListener("mouseleave", () => {
    ptr.on = false;
    ptr.el?.classList.remove("on");
  });
  addEventListener("scroll", () => { if (ptr.mag) wakePointer(); }, { passive: true });
}

// ---------- Listeners ----------
document.addEventListener("mousedown", (e) => {
  if (!insideUI(e)) dismiss();
});

document.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || insideUI(e)) return; // left click only, ignore our own UI
  setTimeout(() => {
    const s = readSelection();
    if (s) showButton(s.anchor, s.text, s.context);
  }, 0);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") dismiss();
});

// Right-click "Dig into…" and Alt+D (sent by background.js)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "DIG_SELECTION") return;
  const s = readSelection();
  const text = s?.text || (msg.text || "").trim().replace(/\s+/g, " ").slice(0, 100);
  if (!text) return;
  dig(s?.anchor || centerAnchor(), text, s?.context || "", false);
});
