// DigDeep background service worker
// Looks up the highlighted term and returns ONE fun fact about it.
// Flip MODE to "backend" when the Databricks backend is live (it returns the same shape).
const CONFIG = {
  MODE: "search",                          // "search" | "decider" | "backend"
  BACKEND_URL: "https://YOUR-BACKEND-URL", // also add "https://YOUR-BACKEND-URL/*" to host_permissions

  // Strands decider agent, served locally by decider_server.py
  DECIDER_URL: "http://localhost:8000/decide",
};

// ---------- Sources (free, no API keys) ----------

// Wikipedia: full article text of the best match (much more material than a summary)
async function fromWikipedia(term, again) {
  const search = await (await fetch(
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=" +
      encodeURIComponent(term)
  )).json();
  const hits = search.query?.search || [];
  // first dig: best match; "another fact": sometimes try the 2nd/3rd match for variety
  const order = again && Math.random() < 0.3 ? [...hits].sort(() => Math.random() - 0.5) : hits;

  for (const hit of order) {
    const data = await (await fetch(
      "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1" +
        "&prop=extracts|pageprops&ppprop=disambiguation&explaintext=1&titles=" +
        encodeURIComponent(hit.title)
    )).json();
    const page = Object.values(data.query?.pages || {})[0];
    if (!page || page.pageprops?.disambiguation !== undefined || !page.extract) continue;
    return { title: page.title, text: page.extract, source: "Wikipedia" };
  }
  return null;
}

// DuckDuckGo Instant Answers: a second source, helps for terms Wikipedia search misses
async function fromDuckDuckGo(term) {
  const d = await (await fetch(
    "https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=" + encodeURIComponent(term)
  )).json();
  if (!d.AbstractText) return null;
  return { title: d.Heading || term, text: d.AbstractText, source: d.AbstractSource || "DuckDuckGo" };
}

// ---------- Picking a "fun" sentence ----------

const FUN_WORDS =
  /\b(only|first|largest|smallest|biggest|oldest|youngest|longest|shortest|highest|lowest|fastest|slowest|deepest|most|least|record|world|unique|unusual|rare|surprising|famous|discovered|invented|accidentally|originally|named after|nicknamed|known as|despite|although|even though|secret|banned|million|billion|percent|times|years old|nearly|over \d)/gi;

function sentencesOf(text) {
  // stop before the reference lists at the bottom of the article (citations aren't facts)
  const cut = text.search(/\n=+\s*(See also|References|Notes|External links|Further reading|Bibliography|Sources|Citations|Footnotes|Works cited)\s*=+/i);
  if (cut > 0) text = text.slice(0, cut);
  return text
    .split("\n")
    .filter((line) => line.trim() && !/^=+.*=+$/.test(line.trim())) // drop section headings
    .join(" ")
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 50 &&
        s.length <= 260 &&
        !/may refer to|see also|citation needed|^\W/i.test(s) &&
        !s.endsWith(":") &&
        !/\b[A-Z]\.$/.test(s) // cut off at an initial, like "Robert A."
    );
}

// niche: 0 = well-known basics, 1 = obscure, specific details (from the Nicheness bar)
function score(sentence, index, total, niche = 0.6) {
  const pos = index / Math.max(total, 1); // 0 = top of the article, 1 = the end
  let s = 0;

  // "Wow" words matter less as nicheness goes up: niche mode wants specifics, not trivia
  s += (sentence.match(FUN_WORDS) || []).length * 1.2 * (1 - niche);

  // Specific details: numbers, names, places, dates, parentheses
  const names = Math.min((sentence.slice(1).match(/\b[A-Z][a-z]{2,}/g) || []).length, 4);
  const specifics = (/\d/.test(sentence) ? 1 : 0) + names * 0.5 + (/\(/.test(sentence) ? 0.5 : 0);
  s += specifics * (0.5 + 2 * niche);

  // General: prefer the top of the article. Niche: prefer the deep sections.
  // (niche side is flat past the first 30%, so it doesn't just grab the last paragraph)
  if (niche < 0.5) s -= (0.5 - niche) * pos * 8;
  else s += (niche - 0.5) * 4 * Math.min(pos / 0.3, 1);

  // The intro is the basics: good for "Basics", bad for "Niche"
  if (index === 0) s += niche < 0.4 ? 3 : -4 * niche;
  if (pos < 0.1 && niche < 0.4) s += 1.5;

  // sentences that lean on the previous one ("This…", "Its…") make no sense alone
  if (/^(this|these|that|those|it|its|they|their|them|he|she|his|her|such|however|but|also|thus|in addition|as a result)\b/i.test(sentence)) s -= 5;
  if (sentence.length > 200) s -= 0.5;
  return s;
}

const seen = new Map(); // term -> facts already shown (so "another fact" doesn't repeat)

function pickFunFact(term, title, text, niche) {
  const all = sentencesOf(text);
  if (!all.length) return null;
  const shown = seen.get(term) || new Set();
  let pool = all
    .map((s, i) => ({ s, score: score(s, i, all.length, niche) }))
    .filter((x) => !shown.has(x.s))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // only the 3 best matches for the nicheness level: much less random
  if (!pool.length) {
    shown.clear(); // shown everything: start over
    pool = all.map((s) => ({ s })).slice(0, 8);
  }
  const fact = pool[Math.floor(Math.random() * pool.length)].s;
  shown.add(fact);
  seen.set(term, shown);
  return fact;
}

async function digSearch(text, again, niche) {
  const term = text.toLowerCase();
  const [wiki, ddg] = await Promise.allSettled([fromWikipedia(text, again), fromDuckDuckGo(text)]);
  const sources = [wiki, ddg].map((r) => (r.status === "fulfilled" ? r.value : null)).filter(Boolean);
  if (!sources.length) return { error: "NOT_FOUND" };

  for (const src of sources) {
    const fact = pickFunFact(term, src.title, src.text, niche);
    if (fact) {
      return {
        title: src.title,
        fact,
        source: src.source,
        surprise_score: null, // filled in by Databricks later
        category: null,       // filled in by Databricks later
      };
    }
  }
  return { error: "NOT_FOUND" };
}

// ---------- Decider mode: Wikipedia gathers options, the Strands decider chooses ----------
// The decider never writes the fact itself. It picks (1) which article matches what the user meant,
// using the text around the highlight, and (2) which real sentence from that article is
// the best accurate fun fact. So every answer is a genuine Wikipedia sentence.

async function wikiArticle(title) {
  const data = await (await fetch(
    "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1" +
      "&prop=extracts|pageprops&ppprop=disambiguation|wikibase-shortdesc&explaintext=1&titles=" +
      encodeURIComponent(title)
  )).json();
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.pageprops?.disambiguation !== undefined || !page.extract) return null;
  return { title: page.title, description: page.pageprops?.["wikibase-shortdesc"] || "", text: page.extract };
}

// Up to 3 matching articles, each with its intro and its 6 most fun-looking sentences
async function buildOptions(term, niche) {
  const search = await (await fetch(
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=" +
      encodeURIComponent(term)
  )).json();
  const hits = search.query?.search || [];
  const articles = (await Promise.all(hits.map((h) => wikiArticle(h.title).catch(() => null)))).filter(Boolean);

  const shown = seen.get(term.toLowerCase()) || new Set();
  return articles
    .map((a) => {
      const all = sentencesOf(a.text);
      const facts = all
        .map((s, i) => ({ s, score: score(s, i, all.length, niche) }))
        .filter((x) => !shown.has(x.s))
        .sort((x, y) => y.score - x.score)
        .slice(0, 6)
        .map((x) => x.s);
      return { ...a, intro: all[0] || "", facts };
    })
    .filter((a) => a.facts.length);
}

function deciderPrompt(term, context, options, niche) {
  const level = Math.round(niche * 100);
  const want =
    niche < 0.35 ? "a clear, well-known basic fact that explains what it is"
    : niche < 0.7 ? "a lesser-known but still easy to follow fact"
    : "a niche, specific detail most people would not know (names, numbers, history, technical specifics), not generic trivia";
  const list = options
    .map((a, i) =>
      `[${i + 1}] ${a.title}${a.description ? " (" + a.description + ")" : ""}\n` +
      `    Intro: ${a.intro}\n` +
      a.facts.map((f, j) => `    ${i + 1}.${j + 1} ${f}`).join("\n")
    )
    .join("\n\n");
  return `You are a decision agent. A user highlighted "${term}" on a webpage.
Text around the highlight: "${context || "(none)"}"

Step 1: choose the article that matches what the user meant (use the surrounding text).
Step 2: from THAT article, choose the fact that is accurate, understandable on its own,
and best matches the nicheness the user asked for: ${level}/100, meaning ${want}.
Do not invent anything; only choose from the options.

OPTIONS:
${list}

Reply with JSON only, no other text:
{"article": <article number>, "fact": "<fact number like 1.3>", "confidence": <0 to 1>}`;
}

// Sends the prompt to decider_server.py: POST {prompt} → {reply}
async function askDecider(prompt) {
  const res = await fetch(CONFIG.DECIDER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Decider returned " + res.status);
  const data = await res.json();
  return data.reply;
}

function parseDecision(reply, options) {
  const json = JSON.parse(reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1));
  const [a, f] = String(json.fact).split(".").map(Number);
  const article = options[(a || json.article) - 1];
  const fact = article?.facts[(f || 0) - 1];
  if (!article || !fact) throw new Error("Decider picked an option that doesn't exist");
  return { article, fact, confidence: Number(json.confidence) || null };
}

async function digDecider({ text, context }, niche) {
  const term = text.toLowerCase();
  const options = await buildOptions(text, niche);
  if (!options.length) return { error: "NOT_FOUND" };

  let choice;
  try {
    choice = parseDecision(await askDecider(deciderPrompt(text, context, options, niche)), options);
  } catch (e) {
    // Decider unreachable or gave a bad answer: fall back to the best-scored option
    console.warn("Decider failed, using fallback:", e);
    choice = { article: options[0], fact: options[0].facts[0], confidence: null };
  }

  const shown = seen.get(term) || new Set();
  shown.add(choice.fact);
  seen.set(term, shown);

  return {
    title: choice.article.title,
    fact: choice.fact,
    source: "Wikipedia",
    confidence: choice.confidence,
    surprise_score: null,
    category: null,
  };
}

// ---------- Backend mode (Databricks), same response shape ----------
async function digBackend({ text, context, page_url, again }, niche) {
  const res = await fetch(CONFIG.BACKEND_URL + "/api/dig", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context, page_url, again, niche }),
  });
  return res.json();
}

async function dig(msg) {
  // Nicheness bar sends 0–100; turn it into 0–1 (default leans niche)
  const raw = Number(msg.niche);
  const niche = Number.isFinite(raw) ? Math.min(Math.max(raw / 100, 0), 1) : 0.6;
  try {
    if (CONFIG.MODE === "backend") return await digBackend(msg, niche);
    if (CONFIG.MODE === "decider") return await digDecider(msg, niche);
    return await digSearch(msg.text, msg.again, niche);
  } catch (e) {
    return { error: "API_DOWN" };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "DIG") {
    dig(msg).then(sendResponse);
    return true; // keep the channel open for the async reply
  }
});

// ---------- Right-click menu ----------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "digdeep",
      title: "Dig into “%s”",
      contexts: ["selection"],
    });
  });
});

function triggerDig(tabId, text) {
  chrome.tabs.sendMessage(tabId, { type: "DIG_SELECTION", text }).catch(() => {
    // Content script not on this page (e.g. chrome:// pages, or page opened before install)
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "digdeep" && tab?.id != null) triggerDig(tab.id, info.selectionText);
});

// ---------- Keyboard shortcut (Alt+D) ----------
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "dig-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) triggerDig(tab.id, "");
});
