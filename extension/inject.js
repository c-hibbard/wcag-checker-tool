// extension/inject.js
(() => {
  const OVERLAY_ID = "wcag-checker-overlay";

  // If user re-runs on the same page, clear the old overlay
  const old = document.getElementById(OVERLAY_ID);
  if (old) old.remove();

  // Try to run immediately if already loaded
  const tryRun = () => {
    if (window.__wcagChecker && typeof window.__wcagChecker.run === "function") {
      try {
        window.__wcagChecker.run();
      } catch (e) {
        console.error("WCAG Checker run failed:", e);
        alert("WCAG Checker: something went wrong running on this page.");
      }
      return true;
    }
    return false;
  };

  if (tryRun()) return;

  // Prevent double-injection if user clicks twice quickly
  if (document.documentElement.dataset.wcagCheckerInjected === "1") {
    // Script may still be loading; poll briefly
    let tries = 0;
    const t = setInterval(() => {
      if (tryRun() || ++tries > 40) clearInterval(t); // ~2s max
    }, 50);
    return;
  }
  document.documentElement.dataset.wcagCheckerInjected = "1";

  // Inject the bundled checker from inside the extension (MV3 CSP-safe)
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("checker.v3.min.js");
  s.async = true;
  s.onload = () => {
    // Clear the flag once loaded
    delete document.documentElement.dataset.wcagCheckerInjected;
    // Run now that the API exists
    tryRun();
  };
  s.onerror = () => {
    delete document.documentElement.dataset.wcagCheckerInjected;
    console.error("WCAG Checker: failed to load checker.v3.min.js");
    alert("WCAG Checker: failed to load.");
  };
  (document.head || document.documentElement).appendChild(s);
})();
