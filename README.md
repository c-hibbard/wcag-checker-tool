# 🧪 WCAG 2.2 Accessibility Checker

A lightweight, browser-based tool that scans webpages for common WCAG 2.2 issues — no install, no account, no data leaves your browser.

- **Live tool:** https://c-hibbard.github.io/wcag-checker-tool/index.html  
- **Auto-run demo:** https://c-hibbard.github.io/wcag-checker-tool/index.html?demo=1&autorun=1

![Demo GIF placeholder – replace with /assets/demo.gif](assets/demo.gif)

## What It Checks
- ❌ Images missing `alt`
- ⚠️ Low contrast between text and background
- ❌ Form inputs missing associated `<label>`

## Quick Start

### Option A — Bookmarklet (fastest)
Right-click this button → **Bookmark link**. Then click it on any page:

**Run Checker:**  
[`Run on this page`](javascript:(()=>{try{window.__wcagCheckerLoaded?window.__wcagChecker.run():(()=>{const s=document.createElement('script');s.src='https://c-hibbard.github.io/wcag-checker-tool/dist/checker.min.js';s.onload=()=>{window.__wcagCheckerLoaded=true;window.__wcagChecker.run();};document.documentElement.appendChild(s)})()}catch(e){alert('WCAG Checker: failed to load. See console.');console.error(e);}})();)

> If your Markdown viewer strips `javascript:` links, use the **Live tool** above and bookmark the **Run Checker** button there.

### Option B — Browser Extension
1. Clone this repo and build (see below), or use the prebuilt `extension/` folder.
2. **Chrome/Edge:** `chrome://extensions` → Enable Developer Mode → **Load unpacked** → select `extension/`.
3. Map a shortcut to “Run Checker” in browser settings (optional).

## Build

```bash
# Install
npm install

# Build the core checker (outputs dist/checker.min.js)
npm run build

# Optional: generate README/index bookmarklet from dist/checker.min.js
npm run make:bookmarklet
