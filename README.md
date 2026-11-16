# DigDeep 🔍

**Highlight any text on the web and get an accurate, interesting fact about it, without leaving the page.**

Built in 24 hours at **MadHacks** by a team of four freshmen.

### ▶️ [Try the live demo](https://scarlet-thunder.github.io/digdeep/)

---

## What it does

1. **Highlight** any word or phrase on any website
2. Click **Dig** (or right-click → *Dig into…*, or press **Alt+D**)
3. A glass card appears right on the word with a fact about it

- **Real facts, never made up.** Every fact is a real sentence from Wikipedia.
- **Understands context.** A Strands AI agent (the "decider") reads the text around your highlight, so *Mercury* on a space page gives you the planet, not the element.
- **Nicheness slider.** Slide from *General* (the basics) to *Niche* (deep-cut details most people don't know).
- **Apple-inspired design.** Frosted Liquid Glass cards, spring animations and a fluid cursor highlight. Follows light and dark mode.

## Install the extension

1. Download this repo: **Code → Download ZIP**, then unzip it
2. Open `chrome://extensions` in Chrome
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and choose the `extension` folder
5. Open any website, highlight a word, and click **Dig**

## Optional: the Strands decider (AI mode)

By default DigDeep picks facts with its own scoring. To let the AI decider choose:

1. Install [Python 3.12](https://www.python.org/downloads/) and [Ollama](https://ollama.com/download), then run `ollama pull llama3.2`
2. In the `decider-server` folder:
   ```
   py -3.12 -m pip install -r requirements.txt
   py -3.12 decider_server.py
   ```
3. In `extension/background.js`, set `MODE: "decider"` and reload the extension

The decider only answers with option numbers (which article, which fact), so it can't invent facts. If it's offline, DigDeep falls back to its best-scored fact.

## How it works

```
Webpage (content.js) → background.js → Wikipedia API → Strands decider → fact card
```

| Part | Tools |
|---|---|
| Extension | Chrome Manifest V3, JavaScript, Shadow DOM, Web Animations API |
| Knowledge | Wikipedia API, DuckDuckGo Instant Answers |
| Decider | Strands Agents, Ollama (Llama 3.2), FastAPI, Python |
| Data (planned) | Databricks |

## Project structure

```
extension/        the Chrome extension (load this folder in Chrome)
decider-server/   optional Strands AI decider (Python)
index.html        the live web demo (GitHub Pages)
demo/worker.js    runs the extension's background.js inside the web demo
```

## What's next

- Chrome Web Store release
- More sources beyond Wikipedia
- Save your digs and turn them into quizzes
- A Databricks dashboard of what people are curious about

## Team

- [Name](https://www.linkedin.com/in/...)
- [Name](https://www.linkedin.com/in/...)
- [Name](https://www.linkedin.com/in/...)
- [Name](https://www.linkedin.com/in/...)
