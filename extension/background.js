// Runs when you click the toolbar button
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false },
    files: ["inject.js"]
});

// Runs when you press the keyboard shortcut (Ctrl/Cmd+Shift+Y)
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "run-checker" || !tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false },
    files: ["inject.js"]
  });
});
