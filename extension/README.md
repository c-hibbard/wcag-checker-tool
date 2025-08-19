# 🧪 WCAG 2.2 Accessibility Checker (Chrome Extension)

A lightweight, browser-based tool that scans webpages for common **WCAG 2.2 accessibility issues** — no install, no account, no fluff.  

👉 **Use it on any site**: detect missing `alt` attributes, low contrast text, unlabeled inputs, and more.  

---

## 🔍 What It Checks
- ❌ Missing `alt` attributes on images  
- ⚠️ Low contrast between text and background  
- ❌ Form inputs missing associated `<label>` elements  
- ❌ Broken or duplicate IDs  
- ⚠️ Links missing descriptive text  

---

## 🚀 Installation

### Option A — One-click download (recommended)  
*(if you’ve published a Release with a pre-zipped `extension/` folder)*  

[![⬇️ Download WCAG Checker](https://img.shields.io/badge/Download-WCAG%20Checker-blue?style=for-the-badge)](https://github.com/YOURUSER/YOURREPO/releases/latest/download/wcag-checker-extension.zip)

1. **Download** the ZIP above.  
2. **Unzip** it anywhere (you’ll see `manifest.json`, `background.js`, `inject.js`, etc.).  
3. Open **Chrome/Edge** → go to `chrome://extensions` (`edge://extensions` on Edge).  
4. Toggle **Developer mode** (top right).  
5. Click **Load unpacked** → select the unzipped folder.  
6. Pin the icon and you’re done. 🎉  

---

### Option B — Download from repository (fallback)  

[![⬇️ Download Repository ZIP](https://img.shields.io/badge/Download-Repository%20ZIP-8A2BE2?style=for-the-badge)](https://github.com/YOURUSER/YOURREPO/archive/refs/heads/main.zip)  

1. **Download** the repo ZIP using the button/link above.  
2. **Unzip** it.  
3. Navigate into the unzipped repo and select the **`extension/`** subfolder (the one containing `manifest.json`).  
4. Open **Chrome/Edge** → `chrome://extensions`.  
5. Enable **Developer mode**.  
6. Click **Load unpacked** → choose the `extension/` subfolder.  
7. Pin the icon and you’re ready to go. ✅  

---

## 🧭 Usage
1. Visit any website (not `chrome://` or the Chrome Web Store).  
2. Click the **WCAG Checker** icon.  
3. The overlay will highlight issues and list them in a side panel.  
4. Tools available:  
   - ✅ Filter by error type  
   - 👁️ Hide/Unhide individual issues  
   - 📋 Copy unique CSS selector for an element  
   - 📤 Export results as JSON  

---

## 🆘 Troubleshooting
- **Could not load manifest** → You probably didn’t pick the `extension/` folder. Make sure `manifest.json` is inside the folder you select.  
- **Nothing happens** → Extensions can’t run on `chrome://*` pages or the Web Store. Try a normal site (like https://example.com).  
- **Local files** → In `chrome://extensions`, enable “Allow access to file URLs.”  
- **Button didn’t download** → Use the plain link:  
