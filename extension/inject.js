(() => {
  const OVERLAY_ID = "wcag-checker-overlay";

  // Clear prior overlay on rerun
  document.getElementById(OVERLAY_ID)?.remove();

  // ------- helpers -------
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
      if (hasImageOrGradient(cs)) return null; // skip: likely gradient/image bg
      const [r,g,b,a] = parseRGB(cs.backgroundColor);
      if (a > 0.01) return [r,g,b,1];
      node = node.parentElement;
    }
    return [255,255,255,1]; // fallback white
  };
  const isLargeText = (cs) => {
    const sizePx = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    return sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
  };
  const cssPath = (el) => {
    // short-ish selector to help devs find it
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

  // ------- run checks (with options) -------
  const options = {
    checkAlt: true,
    checkLabels: true,
    checkContrast: true,
    interactiveOnly: false,
  };

  const runAll = () => {
    const issues = [];
    const pushed = new WeakSet();

    // INTERACTIVE filter
    const interactiveSelector = [
      "a[href]", "button", "input:not([type=hidden])", "select", "textarea", "[role=button]", "[role=link]"
    ].join(",");

    // 1) Alt
    if (options.checkAlt) {
      document.querySelectorAll("img").forEach((el) => {
        if (!isElementVisible(el)) return;
        if (!el.hasAttribute("alt")) {
          issues.push({ type: "Missing label", sub: "alt", el, msg: "<img> missing alt attribute", path: cssPath(el) });
          pushed.add(el);
        }
      });
    }

    // 2) Labels
    if (options.checkLabels) {
      document.querySelectorAll("input, select, textarea").forEach((el) => {
        if (!isElementVisible(el)) return;
        // ignore hidden/obvious non-text controls
        if (el.tagName === "INPUT" && /^(hidden|submit|button|image|reset|file|range|color|checkbox|radio)$/.test(el.type)) return;
        const id = el.id;
        const hasFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const wrapped = el.closest("label");
        const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
        if (!hasFor && !wrapped && !aria) {
          issues.push({ type: "Missing label", sub: "form", el, msg: `${el.tagName.toLowerCase()} has no associated label`, path: cssPath(el) });
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

        const cs = getComputedStyle(el);
        const [fr,fg,fb,fa] = parseRGB(cs.color);
        if (fa < 0.5) return;

        const bg = effectiveBackground(el);
        if (!bg) return;

        const ratio = contrastRatio([fr,fg,fb], bg);
        const threshold = isLargeText(cs) ? 3.0 : 4.5;

        if (ratio < threshold) {
          issues.push({ type: "Low contrast", el, msg: `Contrast ${ratio.toFixed(2)} < ${threshold.toFixed(1)}`, path: cssPath(el) });
          pushed.add(el);
        }
      });
    }

    return issues;
  };

  let issues = runAll();

  // ------- overlay UI -------
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    right: "0",
    maxHeight: "100%",
    overflow: "auto",
    width: "420px",
    zIndex: "2147483647",
    background: "#fff",
    borderLeft: "2px solid #000",
    boxShadow: "-2px 0 5px rgba(0,0,0,.2)",
    font: "14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    padding: "12px"
  });

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const title = document.createElement("h2");
  title.style.margin = "0 0 .5rem";
  const setTitle = () => {
    const counts = issues.reduce((m, i) => (m[i.type]=(m[i.type]||0)+1, m), {});
    const total = issues.length;
    title.textContent = `WCAG Checker — ${total} issues`;
    subtitle.innerHTML = Object.entries(counts).map(([k,v])=>`<span style="margin-right:10px">${k}: <b>${v}</b></span>`).join("");
  };

  const subtitle = document.createElement("div");
  subtitle.style.color = "#444";
  subtitle.style.margin = "0 0 .5rem";

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
    <button id="btn-export" style="grid-column:1/-1;margin-top:4px">Export JSON</button>
  `;
  overlay.appendChild(controls);

  const list = document.createElement("ol");
  list.style.paddingLeft = "1.2em";
  overlay.appendChild(list);

  const renderList = () => {
    list.innerHTML = "";
    const LIMIT = 120;
    issues.slice(0, LIMIT).forEach((it) => {
      const li = document.createElement("li");
      li.textContent = `${it.type}: ${it.msg} — ${it.path}`;
      li.style.marginBottom = ".5em";
      li.style.cursor = "pointer";
      li.onmouseenter = () => { it._oldOutline = it.el.style.outline; it.el.style.outline = "2px solid #f00"; };
      li.onmouseleave = () => { it.el.style.outline = it._oldOutline || ""; };
      li.onclick = () => it.el.scrollIntoView({ behavior: "smooth", block: "center" });
      list.appendChild(li);
    });
    if (issues.length > LIMIT) {
      const more = document.createElement("div");
      more.textContent = `… ${issues.length - LIMIT} more not shown`;
      more.style.color = "#666";
      list.appendChild(more);
    }
    setTitle();
  };

  // Wire up controls
  const byId = (id) => overlay.querySelector(id);
  const reRun = () => { issues = runAll(); renderList(); };

  byId("#opt-alt").addEventListener("change", (e) => { options.checkAlt = e.target.checked; reRun(); });
  byId("#opt-labels").addEventListener("change", (e) => { options.checkLabels = e.target.checked; reRun(); });
  byId("#opt-contrast").addEventListener("change", (e) => { options.checkContrast = e.target.checked; reRun(); });
  byId("#opt-interactive").addEventListener("change", (e) => { options.interactiveOnly = e.target.checked; reRun(); });
  byId("#btn-export").addEventListener("click", () => {
    const payload = issues.map(i => ({
      type: i.type,
      message: i.msg,
      path: i.path
    }));
    const blob = new Blob([JSON.stringify({ url: location.href, issues: payload }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wcag-checker-report.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.marginTop = ".5rem";
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);
  // initial render
  renderList();
})();
