// Content script for Hello World Extension

(function() {
    // Check if the popup (your main app container) already exists
    if (document.getElementById('app')) {
        return;
    }

    // Fetch HTML and CSS from separate files
    const htmlUrl = chrome.runtime.getURL('src/popup.html'); /* Get the URL for popup.html */
    const cssUrl = chrome.runtime.getURL('src/popup.css');   /* Get the URL for popup.css */
    const popupJsUrl = chrome.runtime.getURL('src/popup.js'); /* Get the URL for popup.js */

    // Variables to hold references to the popup and style sheet
    let popupElement = null;
    let styleLinkElement = null;
    
    // Flag to prevent immediate closing on first click
    let isInitialClick = true;

    // Fetch HTML content
    fetch(htmlUrl)
        .then(response => response.text())
        .then(htmlContent => {
            // Add the popup HTML to the page
            document.body.insertAdjacentHTML('beforeend', htmlContent);
            popupElement = document.getElementById('app'); // Store reference to the main popup div

            // Add styles by creating a link tag
            styleLinkElement = document.createElement('link');
            styleLinkElement.rel = 'stylesheet';
            styleLinkElement.href = cssUrl;
            document.head.appendChild(styleLinkElement);

            // Inject popup.js into the page
            // This script will run in the page's isolated world
            const script = document.createElement('script');
            script.src = popupJsUrl;
            document.body.appendChild(script);

            // --- Fix: Implement "click off-screen to close" logic ---
            // We use 'mousedown' instead of 'click' because 'click' fires after 'mouseup',
            // and we want to capture the event before it propagates to elements inside the popup.
            document.addEventListener('mousedown', function(event) {
                if (isInitialClick) {
                    isInitialClick = false; // Allow subsequent clicks to close
                    return;
                }

                // Check if the click is outside the popup element
                if (popupElement && !popupElement.contains(event.target)) {
                    popupElement.style.opacity = '0';
                    
                    setTimeout(() => {
                        if (popupElement && popupElement.parentNode) {
                            popupElement.parentNode.removeChild(popupElement);
                        }
                        if (styleLinkElement && styleLinkElement.parentNode) {
                            styleLinkElement.parentNode.removeChild(styleLinkElement);
                        }
                        // Important: Remove the event listener to clean up resources
                        document.removeEventListener('mousedown', arguments.callee); // 'arguments.callee' refers to the current function
                    }, 300); // Match this with your CSS transition duration if any
                }
            });
            // --- End of "click off-screen to close" logic ---
        })
        .catch(error => console.error('Error loading popup content:', error));

    // Listen for messages from popup.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getSettings") {
            chrome.storage.local.get(request.keys, (items) => {
                sendResponse({ settings: items });
            });
            return true; // Indicate that sendResponse will be called asynchronously
        } else if (request.action === "saveSetting") {
            chrome.storage.local.set({ [request.key]: request.value }, () => {
                sendResponse({ success: true });
            });
            return true; // Indicate that sendResponse will be called asynchronously
        } else if (request.action === "startTimer" || request.action === "pauseTimer" ||
                   request.action === "resetTimer" || request.action === "skipSession") {
            // Forward these actions to the background script
            chrome.runtime.sendMessage(request, (response) => {
                if (response && response.error) {
                    console.error("Error from background script:", response.error);
                }
                sendResponse(response);
            });
            return true; // Indicate that sendResponse will be called asynchronously
        } else if (request.action === "updateTimer") {
            // Forward these actions to the background script
            chrome.runtime.sendMessage(request, (response) => {
                if (response && response.error) {
                    console.error("Error from background script:", response.error);
                }
                sendResponse(response);
            });
            return true;
        }
    });

    // Listen for storage changes and send them to popup.js
    chrome.storage.local.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            const changedSettings = {};
            for (let key in changes) {
                changedSettings[key] = changes[key].newValue;
            }
            // Send message to popup.js to update its UI
            popupElement.dispatchEvent(new CustomEvent('extensionStorageUpdate', { detail: changedSettings }));
        }
    });

    // Handle initial settings load for popup.js once it's loaded
    // This uses a custom event to signal popup.js when it's ready and to receive initial settings
    document.addEventListener('popupReadyForSettings', (event) => {
        const keys = event.detail.keys;
        chrome.storage.local.get(keys, (items) => {
            // Send initial settings back to popup.js via custom event
            popupElement.dispatchEvent(new CustomEvent('initialExtensionSettings', { detail: items }));
        });
    });

})();