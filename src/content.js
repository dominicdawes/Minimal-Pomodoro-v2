// Content script for Hello World Extension

(function() {
    // Check if the popup (your main app container) already exists
    if (document.getElementById('app')) {
        return;
    }

    // Fetch HTML and CSS from separate files
    const htmlUrl = chrome.runtime.getURL('src/popup.html'); /* Get the URL for popup.html */
    const cssUrl = chrome.runtime.getURL('src/popup.css');   /* Get the URL for popup.css */

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

            // --- Fix: Implement "click off-screen to close" logic ---
            // We use 'mousedown' instead of 'click' because 'click' fires after 'mouseup',
            // and we want to capture the event before it bubbles up too much.
            document.addEventListener('mousedown', function(event) {
                // After the first script execution, reset the flag
                if (isInitialClick) {
                    isInitialClick = false;
                    return; // Ignore the very first click that opened the popup
                }

                // If the popup exists and the click target is NOT inside the popup
                if (popupElement && !popupElement.contains(event.target)) {
                    // Start the fade-out effect
                    popupElement.style.opacity = '0';
                    
                    // Remove the popup and stylesheet after the transition
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

            // IMPORTANT: If popup.js contains logic that needs to run
            // directly on the injected HTML, you might need to manually
            // trigger it or ensure it's compatible with elements loaded this way.
            // For simple UI, this might be enough. For complex apps, consider
            // using Shadow DOM or a more structured framework.
            // Example: If popup.js initializes event listeners, they might need
            // to be re-initialized AFTER popup.html's content is inserted.
            // If popup.js is loaded via <script src="popup.js"> in popup.html,
            // that script should execute automatically once its HTML is part of the DOM.
        })
        .catch(error => console.error('Error loading popup content:', error));

})();
