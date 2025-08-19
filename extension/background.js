// background.js (MV3 service worker)

// Helper: run the injector in a given tab
async function runCheckerInTab(tabId) {
  if (!tabId) return;
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ["inject.js"],
  });
}

// Toolbar button click → run on current tab
chrome.action.onClicked.addListener(async (tab) => {
  await runCheckerInTab(tab?.id);
});

// Keyboard shortcut (Ctrl/Cmd+Shift+Y) → find active tab, then run
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "run-checker") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await runCheckerInTab(tab?.id);
});
