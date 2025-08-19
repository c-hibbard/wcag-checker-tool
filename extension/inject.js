(() => {
  const OVERLAY_ID = "wcag-checker-overlay";

  // Remove old overlay on rerun
  document.getElementById(OVERLAY_ID)?.remove();

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
      if (hasImageOrGradient(cs)) return null; // skip gradient/image bgs to reduce false positives
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
    // compact-ish selector shown in UI / copied
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

  // ---------- WCAG reference mapping ----------
  // We display these next to each finding.
  const RULES = {
    alt: { label: "Missing alt", wcag: ["1.1.1 (Non-text Content)"] },
    labels: { label: "Missing label", wcag: ["3.3.2 (Labels or Instructions)", "1.3.1 (Info and Relationships)"] },
    contrast: { label: "Low contrast", wcag: ["1.4.3 (Contrast Minimum)"] }
  };

  // ---------- ignore mechanism ----------
  // Add data-wcag-ignore on any element to skip checks.
  //   data-wcag-ignore="all"  -> skip all rules
  //   data-wcag-ignore="contrast" / "labels" / "alt" (comma-separated allowed)
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

  // Per-item mute state
  const mutedEls = new WeakSet();
  let showMuted = false;

  // Style (overlay + muted)
  const style = document.createElement("style");
  style.textContent = `
    .wcag-muted { opacity:.35 !important; outline:none !important; box-shadow:none !important; }
    #${OVERLAY_ID} *, #${OVERLAY_ID} button { font: inherit; }
    #${OVERLAY_ID} .wcag-row { display:flex; gap:8px; align-items:flex-start; margin-bottom:.6em; }
    #${OVERLAY_ID} .wcag-actions button { margin-left:6px; }
    #${OVERLAY_ID} .wcag-rule { color:#555; font-size:12px; margin-top:2px; }
    #${OVERLAY_ID} .wcag-section { border-top:1px solid #e3e3e3; margin-top:.5rem; padding-top:.5rem; }
    #${OVERLAY_ID} ol { margin:0; }
  `;
  document.head.appendChild(style);

  const applyMuteStates = () => {
    document.querySelectorAll(".wcag-muted").forEach(el => el.classList.remove("wcag-muted"));
    issues.forEach(i => { if (mutedEls.has(i.el)) i.el.classList.add("wcag-muted"); });
  };

  // ---------- run checks ----------
  const runAll = () => {
    const issues = [];
    const pushed = new WeakSet();

    const interactiveSelector = [
      "a[href]","button","input:not([type=hidden])","select","textarea","[role=button]","[role=link]"
    ].join(",");

    // 1) Missing alt
    if (options.checkAlt) {
      document.querySelectorAll("img").forEach((el) => {
        if (!isElementVisible(el)) return;
        if (isIgnored(el, "alt")) return;
        if (!el.hasAttribute("alt")) {
          issues.push({
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
          issues.push({
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

    // 3) Low contrast
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
          issues.push({
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

    return issues;
  };

  let issues = runAll();

  // ---------- overlay UI ----------
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    right: "0",
    maxHeight: "100%",
    overflow: "auto",
    width: "480px",
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
  overlay.appendChild(header);
  overlay.appendChild(subtitle);

  // Controls
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
    <div class="wcag-section" style="grid-column:1/-1;color:#555">
      <b>Ignore via HTML:</b> add <code>data-wcag-ignore="all"</code> or any of
      <code>alt</code>, <code>labels</code>, <code>contrast</code> (comma-separated) to an element to suppress checks on it and its descendants.
    </div>
  `;
  overlay.appendChild(controls);

  // Issues list
  const list = document.createElement("ol");
  list.style.paddingLeft = "1.2em";
  overlay.appendChild(list);

  const renderList = () => {
    list.innerHTML = "";
    const LIMIT = 150;

    const visibleIssues = issues.filter(i => showMuted || !mutedEls.has(i.el));

    visibleIssues.slice(0, LIMIT).forEach((it) => {
      const li = document.createElement("li");
      li.className = "wcag-row";

      // text + rule
      const wrap = document.createElement("div");
      wrap.style.flex = "1";
      const msg = document.createElement("div");
      msg.textContent = `${it.type}: ${it.msg} — ${it.path}`;
      const rule = document.createElement("div");
      rule.className = "wcag-rule";
      rule.textContent = (it.wcag || []).join(" • ");
      wrap.appendChild(msg);
      wrap.appendChild(rule);

      // actions
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

      // Copy selector (NEW)
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
          // fallback
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

  // Wire controls
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

  // Close
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.marginTop = ".5rem";
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);

  // Mount & render
  document.body.appendChild(overlay);
  let issues = runAll(); // ensure state after DOM mutations
  renderList();
  applyMuteStates();
})();
