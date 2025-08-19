(() => {
  const OVERLAY_ID = "wcag-checker-overlay";

  // If rerun → clear old overlay
  const old = document.getElementById(OVERLAY_ID);
  if (old) old.remove();

  function runChecker() {
    const issues = [];

    // ❌ Missing alt on <img>
    document.querySelectorAll("img:not([alt])").forEach((el) => {
      issues.push({ el, msg: "Image missing alt attribute" });
    });

    // ❌ Form inputs without <label>
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (
        !el.id ||
        !document.querySelector(`label[for="${el.id}"]`) &&
        !el.closest("label")
      ) {
        issues.push({ el, msg: "Form input missing associated label" });
      }
    });

    // ⚠️ Low contrast check (very rough)
    const MIN_CONTRAST = 4.5;
    function luminance(r, g, b) {
      [r, g, b] = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function contrast(c1, c2) {
      const l1 = luminance(c1[0], c1[1], c1[2]);
      const l2 = luminance(c2[0], c2[1], c2[2]);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    document.querySelectorAll("*").forEach((el) => {
      const cs = getComputedStyle(el);
      if (!cs.color || !cs.backgroundColor) return;
      const toRgb = (s) =>
        s.match(/\d+/g)?.map((n) => parseInt(n, 10)) || [0, 0, 0];
      const c = toRgb(cs.color);
      const bg = toRgb(cs.backgroundColor);
      if (contrast(c, bg) < MIN_CONTRAST) {
        issues.push({ el, msg: "Low text/background contrast" });
      }
    });

    // Overlay
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      top: 10px; right: 10px;
      background: #fff;
      color: #000;
      font-size: 14px;
      max-height: 50vh;
      overflow: auto;
      border: 2px solid red;
      padding: 8px;
      z-index: 2147483647;
    `;
    overlay.innerHTML = `<b>WCAG Issues (${issues.length})</b><br>`;
    issues.forEach((i) => {
      overlay.innerHTML += `• ${i.msg}<br>`;
      i.el.style.outline = "2px solid red";
    });
    document.body.appendChild(overlay);
  }

  runChecker();
})();
