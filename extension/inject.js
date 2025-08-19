(() => {
  const OVERLAY_ID = "wcag-checker-overlay";

  // ------- helpers -------
  const isElementVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!rect || rect.width === 0 || rect.height === 0) return false;
    if (cs.visibility !== "visible" || parseFloat(cs.opacity) < 0.1) return false;
    if (cs.display === "none") return false;
    // offscreen? still OK if it has text; we just gate hidden/0-size
    return true;
  };

  const isInSvg = (el) => !!el.closest("svg");
  const hasText = (el) => {
    // ignore decorative whitespace
    return !!(el.innerText && el.innerText.replace(/\s+/g, "").length);
  };

  const parseRGB = (s) => {
    // returns [r,g,b,a] with a default 1
    if (!s) return [0, 0, 0, 1];
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
    if (!m) return [0, 0, 0, 1];
    return [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10), m[4] !== undefined ? parseFloat(m[4]) : 1];
  };

  const relLuminance = (r,g,b) => {
    const f = v => {
      v /= 255;
      return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    };
    const R = f(r), G = f(g), B = f(b);
    return 0.2126*R + 0.7152*G + 0.0722*B;
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
    // Walk up until we find a non-transparent background color.
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (hasImageOrGradient(cs)) return null; // skip if bg is image/gradient
      const [r,g,b,a] = parseRGB(cs.backgroundColor);
      if (a > 0.01) return [r,g,b,1];
      node = node.parentElement;
    }
    // fallback: assume white page background
    return [255,255,255,1];
  };

  const isLargeText = (cs) => {
    // large: >= 24px, or >= 18.66px & bold (700+)
    const sizePx = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    return sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
  };

  // ------- run checks -------
  const issues = [];
  const pushed = new WeakSet();

  // 1) Missing alt on images
  document.querySelectorAll("img").forEach((el) => {
    if (!el.hasAttribute("alt")) {
      issues.push({ type: "Missing alt", el, msg: "<img> missing alt attribute" });
      pushed.add(el);
    }
  });

  // 2) Inputs without labels
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    // ignore hidden inputs
    if (el.tagName === "INPUT" && (el.type === "hidden" || el.type === "submit" || el.type === "button" || el.type === "image")) return;
    const id = el.id;
    const hasFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const wrapped = el.closest("label");
    const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (!hasFor && !wrapped && !aria) {
      issues.push({ type: "Missing label", el, msg: `${el.tagName.toLowerCase()} has no associated label` });
      pushed.add(el);
    }
  });

  // 3) Low contrast (smarter, skip noisy cases)
  const SKIP_TAGS = new Set(["HTML","HEAD","META","LINK","STYLE","SCRIPT","NOSCRIPT","BR","HR","IFRAME","SVG","CANVAS","VIDEO","AUDIO","IMG","SOURCE","TRACK","PICTURE"]);
  const all = document.body.querySelectorAll("*");
  all.forEach((el) => {
    if (pushed.has(el)) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (!isElementVisible(el)) return;
    if (!hasText(el)) return;
    if (isInSvg(el)) return;

    const cs = getComputedStyle(el);
    const [fr,fg,fb,fa] = parseRGB(cs.color);
    if (fa < 0.5) return; // very transparent text—skip

    const bg = effectiveBackground(el);
    if (!bg) return; // gradient/image bg -> skip to avoid false positives

    const ratio = contrastRatio([fr,fg,fb], bg);
    const threshold = isLargeText(cs) ? 3.0 : 4.5;

    if (ratio < threshold) {
      issues.push({ type: "Low contrast", el, msg: `Contrast ${ratio.toFixed(2)} < ${threshold.toFixed(1)}` });
      pushed.add(el);
    }
  });

  // ------- overlay UI -------
  // remove old overlay
  document.getElementById(OVERLAY_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    right: "0",
    maxHeight: "100%",
    overflow: "auto",
    width: "380px",
    zIndex: "2147483647",
    background: "#fff",
    borderLeft: "2px solid #000",
    boxShadow: "-2px 0 5px rgba(0,0,0,.2)",
    font: "14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    padding: "1rem"
  });

  // header with counts
  const counts = issues.reduce((m, i) => (m[i.type]=(m[i.type]||0)+1, m), {});
  const total = issues.length;
  const header = document.createElement("div");
  header.innerHTML = `<h2 style="margin:0 0 .5rem">WCAG Checker — ${total} issue${total===1?"":"s"}</h2>
  <div style="color:#444;margin-bottom:.5rem">
    ${Object.entries(counts).map(([k,v])=>`<span style="margin-right:8px">${k}: <b>${v}</b></span>`).join("")}
  </div>`;
  overlay.appendChild(header);

  // list (cap to 100 initially)
  const list = document.createElement("ol");
  list.style.paddingLeft = "1.2em";
  const LIMIT = 100;
  issues.slice(0, LIMIT).forEach((it) => {
    const li = document.createElement("li");
    li.textContent = `${it.type}: ${it.msg}`;
    li.style.marginBottom = ".5em";
    li.style.cursor = "pointer";
    li.onmouseenter = () => { it._oldOutline = it.el.style.outline; it.el.style.outline = "2px solid #f00"; };
    li.onmouseleave = () => { it.el.style.outline = it._oldOutline || ""; };
    li.onclick = () => it.el.scrollIntoView({ behavior: "smooth", block: "center" });
    list.appendChild(li);
  });
  overlay.appendChild(list);

  if (issues.length > LIMIT) {
    const more = document.createElement("button");
    more.textContent = `Show ${issues.length - LIMIT} more`;
    more.style.marginTop = ".5rem";
    more.onclick = () => {
      issues.slice(LIMIT).forEach((it) => {
        const li = document.createElement("li");
        li.textContent = `${it.type}: ${it.msg}`;
        li.style.marginBottom = ".5em";
        li.style.cursor = "pointer";
        li.onmouseenter = () => { it._oldOutline = it.el.style.outline; it.el.style.outline = "2px solid #f00"; };
        li.onmouseleave = () => { it.el.style.outline = it._oldOutline || ""; };
        li.onclick = () => it.el.scrollIntoView({ behavior: "smooth", block: "center" });
        list.appendChild(li);
      });
      more.remove();
    };
    overlay.appendChild(more);
  }

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.margin = ".75rem 0 0";
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);
})();
