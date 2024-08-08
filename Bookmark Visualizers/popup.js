document.addEventListener("DOMContentLoaded", () => {
  const gallery = document.getElementById("gallery");
  const searchBar = document.getElementById("search-bar");
  const themeToggleButton = document.getElementById("theme-toggle-button");

  // Load theme preference from local storage
  chrome.storage.local.get("darkMode", (data) => {
    if (data.darkMode) {
      document.body.classList.add("dark-mode");
      themeToggleButton.textContent = "Toggle Light Mode";
    }
  });

  // Theme toggle button event listener
  themeToggleButton.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");
    themeToggleButton.textContent = isDarkMode
      ? "Toggle Light Mode"
      : "Toggle Dark Mode";

    // Save theme preference in local storage
    chrome.storage.local.set({ darkMode: isDarkMode });
  });

  // Load bookmarks and usage data
  chrome.storage.local.get(
    ["bookmarkUsage", "bookmarks", "customThumbnails"],
    (data) => {
      const usageData = data.bookmarkUsage || {};
      const customThumbnails = data.customThumbnails || {};
      const bookmarks = data.bookmarks[0].children; // Top-level bookmarks and folders
      let allBookmarks = [];

      function traverseBookmarks(bookmarkNodes) {
        bookmarkNodes.forEach((bookmark) => {
          if (bookmark.url) {
            allBookmarks.push(bookmark);
          } else if (bookmark.children) {
            traverseBookmarks(bookmark.children);
          }
        });
      }

      traverseBookmarks(bookmarks);

      // Detect broken and duplicate bookmarks
      function detectIssues(bookmarks) {
        const duplicates = new Set();
        const uniqueUrls = new Set();
        const brokenBookmarks = [];

        bookmarks.forEach((bookmark) => {
          if (uniqueUrls.has(bookmark.url)) {
            duplicates.add(bookmark);
          } else {
            uniqueUrls.add(bookmark.url);
            // Check if the bookmark is reachable
            chrome.runtime.sendMessage(
              { action: "checkUrl", url: bookmark.url },
              (response) => {
                if (!response.ok) {
                  brokenBookmarks.push(bookmark);
                }

                // Display suggestions after all URLs are checked
                if (bookmarks.indexOf(bookmark) === bookmarks.length - 1) {
                  displayCleanupSuggestions(duplicates, brokenBookmarks);
                }
              }
            );
          }
        });

        if (duplicates.size > 0 || brokenBookmarks.length > 0) {
          displayCleanupSuggestions(duplicates, brokenBookmarks);
        }
      }

      function displayCleanupSuggestions(duplicates, brokenBookmarks) {
        const cleanupContainer = document.createElement("div");
        cleanupContainer.classList.add("cleanup-suggestions");
        cleanupContainer.innerHTML = "<h3>Cleanup Suggestions</h3>";

        if (duplicates.size > 0) {
          cleanupContainer.innerHTML += "<p>Duplicate Bookmarks:</p><ul>";
          duplicates.forEach((bookmark) => {
            cleanupContainer.innerHTML += `<li>${bookmark.title} - <a href="${bookmark.url}" target="_blank">${bookmark.url}</a></li>`;
          });
          cleanupContainer.innerHTML += "</ul>";
        }

        if (brokenBookmarks.length > 0) {
          cleanupContainer.innerHTML += "<p>Broken Bookmarks:</p><ul>";
          brokenBookmarks.forEach((bookmark) => {
            cleanupContainer.innerHTML += `<li>${bookmark.title} - <a href="${bookmark.url}" target="_blank">${bookmark.url}</a></li>`;
          });
          cleanupContainer.innerHTML += "</ul>";
        }

        gallery.appendChild(cleanupContainer);
      }

      detectIssues(allBookmarks);

      // Function to display recommendations
      function displayRecommendations(bookmark, container) {
        const recommendations = getRecommendations(bookmark);
        if (recommendations.length > 0) {
          const recommendationContainer = document.createElement("div");
          recommendationContainer.classList.add("recommendations");
          recommendationContainer.innerHTML = "<h4>Recommended Bookmarks</h4>";
          recommendations.forEach((rec) => {
            const recContainer = document.createElement("div");
            recContainer.classList.add("bookmark");

            const img = document.createElement("img");
            img.src =
              customThumbnails[rec.id] ||
              `https://www.google.com/s2/favicons?domain=${rec.url}`;
            img.alt = rec.title;

            const titleLink = document.createElement("a");
            titleLink.href = rec.url;
            titleLink.target = "_blank"; // Open in new tab
            titleLink.textContent = rec.title;
            titleLink.classList.add("title");

            recContainer.appendChild(img);
            recContainer.appendChild(titleLink);
            recommendationContainer.appendChild(recContainer);
          });
          container.appendChild(recommendationContainer);
        }
      }

      function getRecommendations(bookmark) {
        // Simple content-based recommendation system
        const recommendations = [];
        const threshold = 0.3; // Similarity threshold for recommendations
        allBookmarks.forEach((otherBookmark) => {
          if (
            bookmark.id !== otherBookmark.id &&
            calculateSimilarity(bookmark, otherBookmark) > threshold
          ) {
            recommendations.push(otherBookmark);
          }
        });
        return recommendations.slice(0, 3); // Return top 3 recommendations
      }

      function calculateSimilarity(bookmark1, bookmark2) {
        // Simple similarity calculation based on title and URL
        const titleSimilarity = getJaccardSimilarity(
          bookmark1.title,
          bookmark2.title
        );
        const urlSimilarity = getJaccardSimilarity(
          bookmark1.url,
          bookmark2.url
        );
        return (titleSimilarity + urlSimilarity) / 2;
      }

      function getJaccardSimilarity(str1, str2) {
        const set1 = new Set(str1.toLowerCase().split(" "));
        const set2 = new Set(str2.toLowerCase().split(" "));
        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
      }

      function displayBookmarks(bookmarks) {
        gallery.innerHTML = ""; // Clear the gallery
        bookmarks.forEach((bookmark) => {
          const container = document.createElement("div");
          container.classList.add("bookmark");

          const img = document.createElement("img");
          img.src =
            customThumbnails[bookmark.id] ||
            `https://www.google.com/s2/favicons?domain=${bookmark.url}`;
          img.alt = bookmark.title;
          img.addEventListener("click", () => customizeThumbnail(bookmark.id));

          const titleLink = document.createElement("a");
          titleLink.href = bookmark.url;
          titleLink.target = "_blank"; // Open in new tab
          titleLink.textContent = bookmark.title;
          titleLink.classList.add("title");

          const shareButton = document.createElement("button");
          shareButton.textContent = "Share";
          shareButton.classList.add("share-button");
          shareButton.setAttribute("data-url", bookmark.url);
          shareButton.addEventListener("click", () =>
            shareBookmark(shareButton)
          );

          const usageInfo = usageData[bookmark.id] || {
            visits: 0,
            timeSpent: 0,
          };
          const usageText = document.createElement("div");
          usageText.classList.add("usage-info");
          usageText.innerHTML = `
          <div>Visits: ${usageInfo.visits}</div>
          <div>Time Spent: ${usageInfo.timeSpent} minutes</div>
        `;

          container.appendChild(img);
          container.appendChild(titleLink);
          container.appendChild(shareButton);
          container.appendChild(usageText);
          gallery.appendChild(container);

          // Display recommendations directly below the bookmark
          displayRecommendations(bookmark, gallery);
        });
      }

      displayBookmarks(allBookmarks);

      // Filter bookmarks based on search query
      searchBar.addEventListener("input", (event) => {
        const query = event.target.value.toLowerCase();
        const filteredBookmarks = allBookmarks.filter(
          (bookmark) =>
            bookmark.title.toLowerCase().includes(query) ||
            bookmark.url.toLowerCase().includes(query)
        );
        displayBookmarks(filteredBookmarks);
      });
    }
  );
});

// Sharing function
function shareBookmark(button) {
  const url = button.getAttribute("data-url");

  // Share via Email
  const emailSubject = "Check out this bookmark!";
  const emailBody = `I wanted to share this bookmark with you: ${url}`;
  const mailtoLink = `mailto:?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(emailBody)}`;

  // Share via Social Media (e.g., Twitter)
  const twitterLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
    url
  )}&text=Check%20out%20this%20bookmark!`;

  // Optionally, show a UI for sharing choices
  const shareContainer = document.createElement("div");
  shareContainer.classList.add("share-options");
  shareContainer.innerHTML = `
    <a href="${mailtoLink}" target="_blank">Share via Email</a>
    <a href="${twitterLink}" target="_blank">Share on Twitter</a>
  `;
  button.parentNode.appendChild(shareContainer);
}

// Custom Thumbnail function
function customizeThumbnail(bookmarkId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const imgData = reader.result;
      chrome.storage.local.get("customThumbnails", (data) => {
        const customThumbnails = data.customThumbnails || {};
        customThumbnails[bookmarkId] = imgData;
        chrome.storage.local.set({ customThumbnails });
      });
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
