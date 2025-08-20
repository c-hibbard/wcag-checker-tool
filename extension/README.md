# 🧪 WCAG 2.2 Accessibility Checker (Chrome/Edge Extension)

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

## 🚀 Installation (Chrome, Edge, or Chromium-based browsers)

### 1. Download the Extension
[![⬇️ Download WCAG Checker](https://img.shields.io/badge/Download-WCAG%20Checker-blue?style=for-the-badge)](https://github.com/c-hibbard/wcag-checker-tool/raw/main/extension/wcag-checker-tool_001.zip)

### 2. Unpack & Load
1. **Unzip** the downloaded file (`wcag-checker-tool_001.zip`).  
2. Open **Chrome** or **Edge** → go to `chrome://extensions` (or `edge://extensions`).  
3. Toggle **Developer mode** (top right).  
4. Click **Load unpacked** → select the **unzipped folder** (the one that directly contains `manifest.json`).  
   > ⚠️ Don’t select the parent folder — the one you pick must contain `manifest.json` directly.  
5. Pin the WCAG Checker icon and you’re ready to go. 🎉  

### 🔄 Updating
To update, delete the old extension folder, download the latest `.zip` from this repo, and repeat the steps above.  

---

## 🧭 Usage
1. Visit any website (not `chrome://` pages or the Chrome Web Store).  
2. Click the **WCAG Checker** icon.  
3. Issues will be highlighted on the page and listed in a panel.  
4. Tools available inside the panel:  
   - ✅ Filter by error type  
   - 👁️ Toggle individual issues for clarity  
   - 📋 Copy CSS selectors  
   - 📤 Export results as JSON  

![Demo Screenshot/GIF Placeholder](demo.gif)  
*(Optional: Add a GIF or screenshot of the panel here for quick onboarding.)*  

---

## 🆘 Troubleshooting
- **“Could not load manifest”** → Ensure you selected the folder with `manifest.json`.  
- **Nothing happens** → The extension can’t run on `chrome://*` pages or the Chrome Web Store. Try another site.  
- **Local files** → In `chrome://extensions`, enable *Allow access to file URLs*.  

---

## 📄 License
MIT License — free for personal and commercial use.  

---

Built to make the web more accessible, one page at a time. 🌍  

Built to make the web more accessible, one page at a time. 🌍  
