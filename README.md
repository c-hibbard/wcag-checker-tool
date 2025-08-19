# WCAG Checker (WCAG 2.2 • lightweight)

A tiny, browser-based WCAG checker you can run on any site via a Chrome/Edge extension.  
No accounts. No servers. All analysis runs **locally** in your browser.

## What it checks
- **Images missing `alt`** (WCAG **1.1.1**)
- **Form inputs without labels** (WCAG **3.3.2**, **1.3.1**)
- **Low color contrast** for text (WCAG **1.4.3**), with correct thresholds:
  - Normal text: **4.5:1**
  - Large/bold text: **3.0:1** (`≥ 24px` or `≥ 18.66px` & bold)

## Overlay tools (built in)
- **Filters:** toggle Alt / Labels / Contrast
- **Only interactive text:** limit contrast checks to links, buttons, and form controls
- **Counts by type** in the header
- **Per-item Hide / Unhide** to silence a specific finding
- **Show muted items** to review or restore hidden findings
- **Copy selector**: one-click copy of a short CSS selector for the element
- **WCAG references** printed beside each finding
- **Export JSON**: downloads `wcag-checker-report.json` with the page URL + issues
- **Ignore mechanism** in your HTML:
  ```html
  <!-- suppress all checks in this subtree -->
  <div data-wcag-ignore="all">...</div>

  <!-- suppress only certain checks (comma separated) -->
  <div data-wcag-ignore="contrast,labels">...</div>
