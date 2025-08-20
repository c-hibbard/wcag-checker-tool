# 🧪 WCAG 2.2 Accessibility Checker (Chrome Extension)

A lightweight tool that scans webpages for common **WCAG 2.2 accessibility issues** — no install, no account, no fluff.  

👉 **Use it on any site**: detect missing `alt` attributes, low-contrast text, unlabeled inputs, and more.  

---

## 🔍 What It Checks
- ❌ Missing `alt` attributes on images  
- ⚠️ Low contrast between text and background  
- ❌ Form inputs missing associated `<label>` elements  
- ❌ Broken or duplicate IDs  
- ⚠️ Links missing descriptive text  

---

## 🚀 Installation

### 1. Download the Extension
[![⬇️ Download WCAG Checker](https://img.shields.io/badge/Download-WCAG%20Checker-blue?style=for-the-badge)](https://github.com/c-hibbard/wcag-checker-tool/raw/main/extension/wcag-checker-tool_001.zip)

### 2. Unpack & Load
1. **Unzip** the downloaded file (`wcag-checker-tool_001.zip`).  
2. Open Chrome/Edge → go to `chrome://extensions` (or `edge://extensions`).  
3. Toggle **Developer mode** (top right).  
4. Click **Load unpacked** → select the **unzipped folder** (the one containing `manifest.json`).  
5. Pin the icon and you’re ready to go. 🎉  

---

## 🧭 Usage
1. Visit any website (not `chrome://` or the Chrome Web Store).  
2. Click the **WCAG Checker** icon.  
3. Issues will be highlighted on the page and listed in a panel.  
4. Available tools:  
   - ✅ Filter by error type  
   - 👁️ Toggle individual issues  
   - 📋 Copy CSS selectors  
   - 📤 Export results as JSON  

---

## 🆘 Troubleshooting
- **“Could not load manifest”** → Be sure you picked the folder with `manifest.json` after unzipping.  
- **Nothing happens** → The extension can’t run on `chrome://*` pages or the Chrome Web Store. Try another site.  
- **Local files** → In `chrome://extensions`, enable *Allow access to file URLs*.  

---

## 📄 License
MIT License — free for personal and commercial use.  

---

Built to make the web more accessible, one page at a time. 🌍  
