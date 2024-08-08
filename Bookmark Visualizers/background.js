chrome.history.onVisited.addListener((historyItem) => {
  chrome.storage.local.get("bookmarkUsage", (data) => {
    let usageData = data.bookmarkUsage || {};

    // Check if the visited URL is in the bookmarks
    chrome.bookmarks.search({ url: historyItem.url }, (bookmarks) => {
      if (bookmarks.length > 0) {
        const bookmarkId = bookmarks[0].id;
        const siteTime = usageData[bookmarkId] || { visits: 0, timeSpent: 0 };

        // Increment the visits count
        siteTime.visits += 1;

        // Simulate time spent (e.g., add 5 minutes for demonstration)
        siteTime.timeSpent += 5;

        // Store updated data
        usageData[bookmarkId] = siteTime;
        chrome.storage.local.set({ bookmarkUsage: usageData });
      }
    });
  });
});

// Function to check if a URL is reachable
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkUrl") {
    fetch(request.url, { method: "HEAD" })
      .then((response) => {
        sendResponse({ ok: response.ok });
      })
      .catch(() => {
        sendResponse({ ok: false });
      });
    return true; // Will respond asynchronously
  }
});
