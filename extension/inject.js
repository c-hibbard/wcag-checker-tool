(() => {
  const OVERLAY_ID = "wcag-checker-overlay";

  // Remove any prior overlay
  document.getElementById(OVERLAY_ID)?.remove();

  // ---------- license / pro gating ----------
  const LICENSE_KEY = "wcag_license";
  const isValidLicenseFormat = (v) => typeof v === "string" && /^WCAG-[A-Z0-9]{6,}$/i.test(v.trim());

  const storage = {
    async get(key) {
      try {
        if (chrome?.storage?.sync) {
          return new Promise((res) => chrome.storage.sync.get([key], (obj) => res(obj[key])));
        }
      } catch {}
      try { return JSON.parse(localStorage.getItem(key)); } catch { return localStorage.getItem(key); }
    },
    async set(key, value) {
      try {
        if (chrome?.storage?.sync) {
          return new Promise((res) => chrome.storage.sync.set({ [key]: value }, () => res(true)));
        }
      } catch {}
      try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch {}
    }
  };

  let IS_PRO = false;
  const checkLicense = async () => {
    const v = await storage.get(LICENSE_KEY);
    IS_PRO = isValidLicenseFormat(v || "");
    return IS_PRO;
  };

  // ---------- helpers ----------
  const isElementVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!rect || rect.width === 0 || rect.height === 0) return false;
    if (cs.visibility !== "visible" || parseFloat(cs.opacity) < 0.1) return false;
    if (cs.display === "none") return false;
    return true;
  };
  const hasText = (el) => !!(el.innerText && el.innerText.replace(/\s+/g, "").length);
  const isInSvg = (el) => !!el.closest("svg");
  const parseRGB = (s) => {
    if (!s) return [0,0,0,1];
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
    return m ? [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10), m[4]!==undefined?parseFloat(m[4]):1] : [0,0,0,1];
  };
  const relLuminance = (r,g,b) => {
    const f = v => (v/=255) <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
  };
  const contrastRatio = (fg, bg) => {
    const L1 = relLuminance(fg[0], fg[1], fg[2]);
    const L2 = relLuminance(bg[0], bg[1], bg[2]);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  const hasImageOrGradient = (cs) =>
    (cs.backgroundImage && cs.backgroundImage !== "none") ||
    (cs.webkitBackgroundClip && cs.webkitBackgroundClip === "text");
  const effectiveBackground = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (hasImageOrGradient(cs)) return null;
      const [r,g,b,a] = parseRGB(cs.backgroundColor);
      if (a > 0.01) return [r,g,b,1];
      node = node.parentElement;
    }
    return [255,255,255,1];
  };
  const isLargeText = (cs) => {
    const sizePx = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    return sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
  };
  const cssPath = (el) => {
    try {
      const parts = [];
      let n = el;
      while (n && n.nodeType === 1 && parts.length < 5) {
        const id = n.id ? `#${CSS.escape(n.id)}` : "";
        const classes = (n.className && typeof n.className === "string")
          ? "." + n.className.trim().split(/\s+/).slice(0,2).map(CSS.escape).join(".")
          : "";
        parts.unshift(n.tagName.toLowerCase() + id + classes);
        if (id) break;
        n = n.parentElement;
      }
      return parts.join(" > ");
    } catch { return el.tagName.toLowerCase(); }
  };
  const debounce = (fn, wait = 400) => {
    let t; 
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  };

  // ---------- WCAG references ----------
  const RULES = {
    alt:      { label: "Missing alt",    wcag: ["1.1.1 (Non-text Content)"] },
    labels:   { label: "Missing label",  wcag: ["3.3.2 (Labels or Instructions)", "1.3.1 (Info and Relationships)"] },
    contrast: { label: "Low contrast",   wcag: ["1.4.3 (Contrast Minimum)"] }
  };

  // ---------- ignore mechanism ----------
  // data-wcag-ignore="all" or comma list e.g. "contrast,labels"
  const isIgnored = (el, kind) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const raw = n.getAttribute("data-wcag-ignore");
      if (raw) {
        const tokens = raw.split(",").map(s => s.trim().toLowerCase());
        if (tokens.includes("all") || tokens.includes(kind)) return true;
      }
      n = n.parentElement;
    }
    return false;
  };

  // ---------- options & state ----------
  const options = {
    checkAlt: true,
    checkLabels: true,
    checkContrast: true,
    interactiveOnly: false
  };
  const mutedEls = new WeakSet(); // per-item Hide/Unhide
  let showMuted = false;
  let issues = []; // filled by runAll()

  // ---------- styles ----------
  const style = document.createElement("style");
  style.textContent = `
    .wcag-muted { opacity:.35 !important; outline:none !important; box-shadow:none !important; }
    #${OVERLAY_ID} *, #${OVERLAY_ID} button { font: inherit; }
    #${OVERLAY_ID} .wcag-row { display:flex; gap:8px; align-items:flex-start; margin-bottom:.6em; }
    #${OVERLAY_ID} .wcag-actions button { margin-left:6px; }
    #${OVERLAY_ID} .wcag-rule { color:#555; font-size:12px; margin-top:2px; }
    #${OVERLAY_ID} .wcag-section { border-top:1px solid #e3e3e3; margin-top:.5rem; padding-top:.5rem; }
    #${OVERLAY_ID} .pro-badge { display:inline-block; padding:0 .35em; border-radius:.35em; border:1px solid #9155f8; color:#9155f8; font-size:11px; margin-left:6px; }
    #${OVERLAY_ID} .pro-note { color:#6b4efc; font-size:12px; }
    #${OVERLAY_ID} .disabled { opacity:.5; pointer-events:none; }
    #${OVERLAY_ID} .modal {
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      display:flex; align-items:center; justify-content:center; z-index:2147483647;
    }
    #${OVERLAY_ID} .modal-card {
      background:#fff; border:1px solid #ddd; border-radius:.75rem; padding:16px; width: 420px;
      box-shadow:0 8px 30px rgba(0,0,0,.25);
    }
    #${OVERLAY_ID} .modal-card h3 { margin:0 0 .25rem; }
    #${OVERLAY_ID} input[type="text"].license { width:100%; padding:.55rem; border:1px solid #ddd; border-radius:.5rem; }
  `;
  document.head.appendChild(style);

  const applyMuteStates = () => {
    document.querySelectorAll(".wcag-muted").forEach(el => el.classList.remove("wcag-muted"));
    issues.forEach(i => { if (mutedEls.has(i.el)) i.el.classList.add("wcag-muted"); });
  };

  // ---------- scanner ----------
  const runAll = () => {
    const results = [];
    const pushed = new WeakSet(); // avoid dupes

    const interactiveSelector = [
      "a[href]","button","input:not([type=hidden])","select","textarea","[role=button]","[role=link]"
    ].join(",");

    // 1) Alt
    if (options.checkAlt) {
      document.querySelectorAll("img").forEach((el) => {
        if (!isElementVisible(el)) return;
        if (isIgnored(el, "alt")) return;
        if (!el.hasAttribute("alt")) {
          results.push({
            type: "Missing label",
            rule: "alt",
            el,
            msg: "<img> missing alt attribute",
            path: cssPath(el),
            wcag: RULES.alt.wcag
          });
          pushed.add(el);
        }
      });
    }

    // 2) Inputs without labels
    if (options.checkLabels) {
      document.querySelectorAll("input, select, textarea").forEach((el) => {
        if (!isElementVisible(el)) return;
        if (isIgnored(el, "labels")) return;
        if (el.tagName === "INPUT" && /^(hidden|submit|button|image|reset|file|range|color|checkbox|radio)$/.test(el.type)) return;
        const id = el.id;
        const hasFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const wrapped = el.closest("label");
        const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
        if (!hasFor && !wrapped && !aria) {
          results.push({
            type: "Missing label",
            rule: "labels",
            el,
            msg: `${el.tagName.toLowerCase()} has no associated label`,
            path: cssPath(el),
            wcag: RULES.labels.wcag
          });
          pushed.add(el);
        }
      });
    }

    // 3) Contrast
    if (options.checkContrast) {
      const SKIP_TAGS = new Set(["HTML","HEAD","META","LINK","STYLE","SCRIPT","NOSCRIPT","BR","HR","IFRAME","SVG","CANVAS","VIDEO","AUDIO","IMG","SOURCE","TRACK","PICTURE"]);
      const nodes = options.interactiveOnly ? document.querySelectorAll(interactiveSelector) : document.body.querySelectorAll("*");
      nodes.forEach((el) => {
        if (pushed.has(el)) return;
        if (SKIP_TAGS.has(el.tagName)) return;
        if (!isElementVisible(el)) return;
        if (!hasText(el)) return;
        if (isInSvg(el)) return;
        if (el.getAttribute("aria-hidden") === "true") return;
        if (isIgnored(el, "contrast")) return;

        const cs = getComputedStyle(el);
        const [fr,fg,fb,fa] = parseRGB(cs.color);
        if (fa < 0.5) return;

        const bg = effectiveBackground(el);
        if (!bg) return;

        const ratio = contrastRatio([fr,fg,fb], bg);
        const threshold = isLargeText(cs) ? 3.0 : 4.5;

        if (ratio < threshold) {
          results.push({
            type: "Low contrast",
            rule: "contrast",
            el,
            msg: `Contrast ${ratio.toFixed(2)} < ${threshold.toFixed(1)}`,
            path: cssPath(el),
            wcag: RULES.contrast.wcag
          });
          pushed.add(el);
        }
      });
    }

    return results;
  };

  // ---------- Pro helpers (gated) ----------
  const nearestAccessibleColor = (fg, bg, target = 4.5) => {
    // naive approach: move fg towards black/white to reach target
    const toRatio = (c) => contrastRatio(parseRGB(c), parseRGB(bg));
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    const [r,g,b] = parseRGB(fg);
    const trySteps = (towards) => {
      let rr = r, gg = g, bb = b;
      for (let i=0;i<40;i++) {
        rr = clamp(rr + (towards === "white" ? 6 : -6));
        gg = clamp(gg + (towards === "white" ? 6 : -6));
        bb = clamp(bb + (towards === "white" ? 6 : -6));
        const cr = contrastRatio([rr,gg,bb], parseRGB(bg));
        if (cr >= target) return `rgb(${rr}, ${gg}, ${bb})`;
      }
      return null;
    };
    return trySteps("black") || trySteps("white");
  };

  const renderUpgradeModal = (overlay, reason = "This feature requires Pro.") => {
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Upgrade to Pro">
        <h3>Unlock Pro</h3>
        <p class="pro-note">${reason}</p>
        <ol style="padding-left:1.2em">
          <li>Get a license at <a href="https://wcagchecker.carrd.co" target="_blank" rel="noopener">wcagchecker.carrd.co</a></li>
          <li>Paste your key below (format <code>WCAG-XXXXXX</code>)</li>
        </ol>
        <input type="text" class="license" placeholder="WCAG-XXXXXX" />
        <div style="margin-top:.6rem;display:flex;gap:.5rem;justify-content:flex-end">
          <button id="pro-cancel">Cancel</button>
          <button id="pro-activate">Activate</button>
        </div>
      </div>
    `;
    overlay.appendChild(m);
    m.querySelector("#pro-cancel").onclick = () => m.remove();
    m.querySelector("#pro-activate").onclick = async () => {
      const val = m.querySelector("input.license").value.trim();
      if (!isValidLicenseFormat(val)) {
        alert("Invalid key format. Expected WCAG-XXXXXX");
        return;
      }
      await storage.set(LICENSE_KEY, val);
      await checkLicense();
      m.remove();
      alert("Pro activated. Thanks!");
      // Re-render to enable Pro controls
      renderList();
      setTitle();
      wireProControls();
    };
  };

  // ---------- overlay UI ----------
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("data-wcag-ignore", "all"); // never scan our own UI
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    right: "0",
    maxHeight: "100%",
    overflow: "auto",
    width: "500px",
    zIndex: "2147483647",
    background: "#fff",
    borderLeft: "2px solid #000",
    boxShadow: "-2px 0 5px rgba(0,0,0,.2)",
    font: "14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    padding: "12px"
  });

  const header = document.createElement("div");
  const title = document.createElement("h2");
  title.style.margin = "0 0 .5rem";
  const subtitle = document.createElement("div");
  subtitle.style.color = "#444";
  subtitle.style.margin = "0 0 .5rem";

  const setTitle = () => {
    const visibleCount = issues.filter(i => showMuted || !mutedEls.has(i.el)).length;
    const counts = issues.reduce((m, i) => (m[i.type]=(m[i.type]||0)+1, m), {});
    title.textContent = `WCAG Checker — ${visibleCount} issues`;
    subtitle.innerHTML = Object.entries(counts).map(([k,v])=>`<span style="margin-right:10px">${k}: <b>${v}</b></span>`).join("");
  };

  header.appendChild(title);
  header.appendChild(subtitle);
  overlay.appendChild(header);

  // Controls (Free + Pro)
  const controls = document.createElement("div");
  controls.style.display = "grid";
  controls.style.gridTemplateColumns = "repeat(2, minmax(0,1fr))";
  controls.style.gap = "6px 12px";
  controls.style.marginBottom = ".5rem";
  controls.innerHTML = `
    <label><input type="checkbox" id="opt-alt" checked> Alt</label>
    <label><input type="checkbox" id="opt-labels" checked> Labels</label>
    <label><input type="checkbox" id="opt-contrast" checked> Contrast</label>
    <label><input type="checkbox" id="opt-interactive"> Only interactive text</label>
    <label style="grid-column:1/-1"><input type="checkbox" id="opt-show-muted"> Show muted items</label>
    <button id="btn-export" style="grid-column:1/-1;margin-top:4px">Export JSON</button>

    <div class="wcag-section" style="grid-column:1/-1">
      <button id="btn-export-pdf">Export PDF <span class="pro-badge">Pro</span></button>
      <button id="btn-focus-map">Focus order map <span class="pro-badge">Pro</span></button>
      <button id="btn-color-suggest">Color suggestions <span class="pro-badge">Pro</span></button>
    </div>

    <div class="wcag-section" style="grid-column:1/-1;color:#555">
      <b>Ignore via HTML:</b> add <code>data-wcag-ignore="all"</code> or any of
      <code>alt</code>, <code>labels</code>, <code>contrast</code> (comma-separated) to suppress checks for an element subtree.
    </div>

    <div class="wcag-section" style="grid-column:1/-1;color:#555">
      <b>Persist ignore (domain)</b> <span class="pro-badge">Pro</span><br>
      <button id="btn-save-ignore">Save current muted as domain rules</button>
      <button id="btn-clear-ignore">Clear domain rules</button>
      <div id="domain-note" class="pro-note"></div>
    </div>
  `;
  overlay.appendChild(controls);

  // Issues list
  const list = document.createElement("ol");
  list.style.paddingLeft = "1.2em";
  overlay.appendChild(list);

  // Close (disconnect observer on click)
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.marginTop = ".5rem";
  overlay.appendChild(closeBtn);

  // Render list
  const renderList = () => {
    list.innerHTML = "";
    const LIMIT = 150;
    const visibleIssues = issues.filter(i => showMuted || !mutedEls.has(i.el));

    visibleIssues.slice(0, LIMIT).forEach((it) => {
      const li = document.createElement("li");
      li.className = "wcag-row";

      const wrap = document.createElement("div");
      wrap.style.flex = "1";
      const msg = document.createElement("div");
      msg.textContent = `${it.type}: ${it.msg} — ${it.path}`;
      const rule = document.createElement("div");
      rule.className = "wcag-rule";
      rule.textContent = (it.wcag || []).join(" • ");
      wrap.appendChild(msg);
      wrap.appendChild(rule);

      const actions = document.createElement("div");
      actions.className = "wcag-actions";
      actions.style.whiteSpace = "nowrap";

      // Hide/Unhide (element-specific)
      const btnHide = document.createElement("button");
      const setHideLabel = () => {
        btnHide.textContent = mutedEls.has(it.el) ? "Unhide" : "Hide";
        btnHide.title = mutedEls.has(it.el)
          ? "Show this item again in the list"
          : "Hide this exact item from the list";
      };
      setHideLabel();
      btnHide.onclick = (e) => {
        e.stopPropagation();
        if (mutedEls.has(it.el)) {
          mutedEls.delete(it.el);
          it.el.classList.remove("wcag-muted");
        } else {
          mutedEls.add(it.el);
          it.el.classList.add("wcag-muted");
        }
        renderList();
        applyMuteStates();
      };

      // Focus (scroll to)
      const btnFocus = document.createElement("button");
      btnFocus.textContent = "Focus";
      btnFocus.title = "Scroll to element";
      btnFocus.onclick = (e) => {
        e.stopPropagation();
        it.el.scrollIntoView({ behavior: "smooth", block: "center" });
      };

      // Copy selector
      const btnCopy = document.createElement("button");
      btnCopy.textContent = "Copy";
      btnCopy.title = "Copy selector to clipboard";
      btnCopy.onclick = async (e) => {
        e.stopPropagation();
        const text = it.path || cssPath(it.el);
        try {
          await navigator.clipboard.writeText(text);
          btnCopy.textContent = "Copied!";
          setTimeout(() => (btnCopy.textContent = "Copy"), 900);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          btnCopy.textContent = "Copied!";
          setTimeout(() => (btnCopy.textContent = "Copy"), 900);
        }
      };

      actions.appendChild(btnHide);
      actions.appendChild(btnFocus);
      actions.appendChild(btnCopy);

      li.onmouseenter = () => {
        if (mutedEls.has(it.el)) return;
        it._oldOutline = it.el.style.outline;
        it.el.style.outline = "2px solid #f00";
      };
      li.onmouseleave = () => { it.el.style.outline = it._oldOutline || ""; };
      li.onclick = () => it.el.scrollIntoView({ behavior: "smooth", block: "center" });

      li.appendChild(wrap);
      li.appendChild(actions);
      list.appendChild(li);
    });

    if (visibleIssues.length > LIMIT) {
      const more = document.createElement("div");
      more.textContent = `… ${visibleIssues.length - LIMIT} more not shown`;
      more.style.color = "#666";
      list.appendChild(more);
    }

    setTitle();
  };

  // Wiring (free)
  const byId = (sel) => overlay.querySelector(sel);
  const reRun = () => { issues = runAll(); renderList(); applyMuteStates(); };

  byId("#opt-alt").addEventListener("change", (e) => { options.checkAlt = e.target.checked; reRun(); });
  byId("#opt-labels").addEventListener("change", (e) => { options.checkLabels = e.target.checked; reRun(); });
  byId("#opt-contrast").addEventListener("change", (e) => { options.checkContrast = e.target.checked; reRun(); });
  byId("#opt-interactive").addEventListener("change", (e) => { options.interactiveOnly = e.target.checked; reRun(); });
  byId("#opt-show-muted").addEventListener("change", (e) => { showMuted = e.target.checked; renderList(); });

  // Export JSON (respects current filters & muted)
  byId("#btn-export").addEventListener("click", () => {
    const payload = issues
      .filter(i => showMuted || !mutedEls.has(i.el))
      .map(i => ({ type: i.type, message: i.msg, path: i.path, wcag: i.wcag }));
    const blob = new Blob([JSON.stringify({ url: location.href, issues: payload }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wcag-checker-report.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- Pro controls wiring (gated handlers) ----------
  const wireProControls = () => {
    const note = byId("#domain-note");
    if (!IS_PRO) {
      note.textContent = "Sign in with a license to save muted elements as domain rules and auto-apply next time.";
    } else {
      note.textContent = `Pro active on ${location.hostname}`;
    }

    const guard = (cb, reason) => (e) => {
      if (!IS_PRO) {
        e?.preventDefault?.();
        renderUpgradeModal(overlay, reason);
        return;
      }
      cb(e);
    };

    // PDF export (stub)
    byId("#btn-export-pdf").onclick = guard(() => {
      // Simple stub; you can later implement real capture-to-pdf via chrome.tabs.captureVisibleTab + jsPDF in bg page
      alert("PDF export (Pro): coming soon.\n(Your license is valid; this stub proves gating works.)");
    }, "Export PDF reports with counts, page URL, and optional screenshots.");

    // Focus map (tab order)
    byId("#btn-focus-map").onclick = guard(() => {
      const prev = document.querySelectorAll("[data-wcag-focus-ring]");
      prev.forEach(el => el.removeAttribute("data-wcag-focus-ring"));
      let idx = 1;
      const tabbables = [...document.querySelectorAll(`
        a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])
      `)].filter(el => isElementVisible(el) && el.getAttribute("tabindex") !== "-1");
      tabbables.forEach(el => {
        el.setAttribute("data-wcag-focus-ring", idx++);
        const r = document.createElement("div");
        r.textContent = el.getAttribute("data-wcag-focus-ring");
        Object.assign(r.style, {
          position: "absolute", background: "#000", color: "#fff", borderRadius: "10px",
          padding: "2px 6px", fontSize: "12px", zIndex: "2147483646"
        });
        const b = el.getBoundingClientRect();
        r.style.left = `${Math.max(0, b.left + window.scrollX)}px`;
        r.style.top  = `${Math.max(0, b.top + window.scrollY - 18)}px`;
        r.className = "wcag-focus-tag";
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 3000); // ephemeral tag
      });
      alert(`Focus map: tagged ${tabbables.length} tabbable elements (numbers fade in ~3s).`);
    }, "Visualize tab focus order across the page.");

    // Color suggestions (nearest accessible)
    byId("#btn-color-suggest").onclick = guard(() => {
      const firstContrast = issues.find(i => i.rule === "contrast");
      if (!firstContrast) {
        alert("No low-contrast items to fix here.");
        return;
      }
      const el = firstContrast.el;
      const cs = getComputedStyle(el);
      const bg = effectiveBackground(el);
      if (!bg) { alert("Background has image/gradient; skipping."); return; }
      const fg = cs.color;
      const target = isLargeText(cs) ? 3.0 : 4.5;
      const suggested = nearestAccessibleColor(fg, `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`, target);
      if (suggested) {
        alert(`Suggested color for "${firstContrast.path}":\n\nCurrent: ${fg}\nSuggested: ${suggested}\nTarget ratio: ${target}:1`);
      } else {
        alert("Could not find a near accessible color within search steps.");
      }
    }, "Get a near-by color suggestion that meets WCAG contrast threshold.");

    // Persist ignore rules (domain)
    const key = `wcag_ignore_rules::${location.hostname}`;
    byId("#btn-save-ignore").onclick = guard(async () => {
      const paths = issues.filter(i => mutedEls.has(i.el)).map(i => i.path);
      await storage.set(key, paths);
      alert(`Saved ${paths.length} muted selectors for ${location.hostname}. They’ll auto-apply next time.`);
    }, "Save current muted items as domain-level ignore rules.");
    byId("#btn-clear-ignore").onclick = guard(async () => {
      await storage.set(key, []);
      alert(`Cleared persisted ignore rules for ${location.hostname}.`);
    }, "Clear domain-level ignore rules.");

    // Auto-apply persisted ignores when Pro is active
    (async () => {
      if (!IS_PRO) return;
      const saved = await storage.get(key);
      if (Array.isArray(saved) && saved.length) {
        issues.forEach(i => { if (saved.includes(i.path)) mutedEls.add(i.el); });
        renderList();
        applyMuteStates();
      }
    })();
  };

  // Mount & initial render
  document.body.appendChild(overlay);

  // Initial scan AFTER overlay exists (overlay is ignored via data-wcag-ignore)
  issues = runAll();
  renderList();
  applyMuteStates();

  // --- Re-scan when the page changes (debounced)
  const recheck = debounce(() => {
    issues = runAll();
    renderList();
    applyMuteStates();
  }, 500);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (overlay.contains(m.target)) continue; // ignore our own UI changes
      recheck();
      break;
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: false
  });

  // Close: disconnect observer and remove overlay
  closeBtn.onclick = () => {
    try { observer.disconnect(); } catch {}
    overlay.remove();
  };

  // top panel controls listeners (after DOM is ready)
  const byId = (sel) => overlay.querySelector(sel); // re-declare here for bundlers without hoist
  overlay.querySelector("#opt-alt").addEventListener("change", (e) => { options.checkAlt = e.target.checked; issues = runAll(); renderList(); applyMuteStates(); });
  overlay.querySelector("#opt-labels").addEventListener("change", (e) => { options.checkLabels = e.target.checked; issues = runAll(); renderList(); applyMuteStates(); });
  overlay.querySelector("#opt-contrast").addEventListener("change", (e) => { options.checkContrast = e.target.checked; issues = runAll(); renderList(); applyMuteStates(); });
  overlay.querySelector("#opt-interactive").addEventListener("change", (e) => { options.interactiveOnly = e.target.checked; issues = runAll(); renderList(); applyMuteStates(); });
  overlay.querySelector("#opt-show-muted").addEventListener("change", (e) => { showMuted = e.target.checked; renderList(); });

  // JSON export (duplicate for safety if earlier reference changes)
  overlay.querySelector("#btn-export").addEventListener("click", () => {
    const payload = issues
      .filter(i => showMuted || !mutedEls.has(i.el))
      .map(i => ({ type: i.type, message: i.msg, path: i.path, wcag: i.wcag }));
    const blob = new Blob([JSON.stringify({ url: location.href, issues: payload }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wcag-checker-report.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Pro controls & license check
  (async () => {
    await checkLicense();
    wireProControls();

    // If not Pro, visually disable Pro buttons (still clickable → opens modal)
    if (!IS_PRO) {
      ["#btn-export-pdf", "#btn-focus-map", "#btn-color-suggest", "#btn-save-ignore", "#btn-clear-ignore"]
        .forEach(sel => {
          const b = byId(sel);
          if (b && sel !== "#btn-export-pdf") b.classList.add("disabled");
          // Note: export-pdf left enabled so clicking shows the modal (UX hint)
        });
    }
  })();
})();
