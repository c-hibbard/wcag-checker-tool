// background.js (MV3 service worker)

async function runCheckerInTab(tabId) {
  if (!tabId) return;
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ["inject.js"],
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  await runCheckerInTab(tab?.id);
});
