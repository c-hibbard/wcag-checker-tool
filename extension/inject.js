// MV3 cannot execute remote code; we load the bundled checker file from the extension itself.
(function () {
  // If overlay exists, remove then rerun for a fresh pass
  const old = document.getElementById("wcag-checker-overlay");
  if (old) old.remove();

  // Make sure the checker API is present, then run it
  const runNow = () => {
    if (window.__wcagChecker && typeof window.__wcagChecker.run === "function") {
      try { window.__wcagChecker.run(); } catch (e) { console.error("WCAG Checker run failed:", e); }
    } else {
      console.error("WCAG Checker not available.");
      alert("WCAG Checker: failed to load.");
    }
  };

  // If already injected in this page, just run
  if (window.__wcagChecker) return runNow();

  // Otherwise, inject the local bundled scanner from the extension
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("checker.v3.min.js");
  s.onload = runNow;
  document.documentElement.appendChild(s);
})();
