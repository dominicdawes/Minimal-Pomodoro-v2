// background.js
// Service worker for alarms, badge updates, notifications, sound
// persists even whan popup is closed

const ALARM_NAME = 'pomodoro_tick';

// Default settings
const DEFAULTS = {
  focus: 25,            // minutes
  shortBreak: 5,        // minutes
  longBreak: 15,        // minutes
  sessionsBeforeLong: 4,
  currentSession: 'focus',  // 'focus' | 'shortBreak' | 'longBreak'
  sessionCount: 0,          // how many focus sessions completed
  remainingSec: 25 * 60,    // seconds left in current session
  timerRunning: false
};

// Listen for the extension icon to be clicked (COMMENT OUT IF NOT: injecting HTML for rounding corners into the DOM)
chrome.action.onClicked.addListener((tab) => {
  // Get the current tab ID
  const tabId = tab.id;
  
  // Inject the content script into the current tab
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['src/content.js'] /* Updated path */
  });
  
  console.log(`Content script injected into tab ${tabId}`);
});

// On install or upgrade, seed defaults if none exist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULTS), prefs => {
    const toSet = {};
    for (let k in DEFAULTS) {
      if (prefs[k] === undefined) toSet[k] = DEFAULTS[k];
    }
    if (Object.keys(toSet).length) {
      chrome.storage.local.set(toSet);
    }
  });
  chrome.action.setBadgeText({ text: '' });
});

// Listen to messages from popup.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try { // Added try/catch
    switch (msg.action) {
      case 'start':
        startTimer();
        break;
      case 'pause':
        pauseTimer();
        break;
      case 'reset':
        resetTimer();
        break;
      case 'skipSession': // New: Handle skip session action
        skipToNextSession();
        break;
      case 'updateDurations':
        // msg.durations = { focus, shortBreak, longBreak, sessionsBeforeLong }
        chrome.storage.local.set(msg.durations);
        // also reset remainingSec if timer is not running and we're on that session
        chrome.storage.local.get(['timerRunning','currentSession'], prefs => {
          if (!prefs.timerRunning) {
            chrome.storage.local.get(prefs.currentSession, d => {
              chrome.storage.local.set({ remainingSec: d[prefs.currentSession] * 60 });
              updateBadge(d[prefs.currentSession] * 60, prefs.currentSession);
            });
          }
        });
        break;
    }
    sendResponse();
  } catch (e) {
    console.error("Error in chrome.runtime.onMessage listener:", e);
    sendResponse({ error: e.message }); // Send response even on error
  }
  return true; // Indicates asynchronous response
});


// ALARM tick handler
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== ALARM_NAME) return;

  try { // Added try/catch for the main alarm logic
    chrome.storage.local.get([
      'timerRunning','remainingSec',
      'focus','shortBreak','longBreak',
      'currentSession','sessionCount','sessionsBeforeLong'
    ], prefs => {
      if (!prefs.timerRunning) return;

      let { remainingSec, currentSession, sessionCount, sessionsBeforeLong } = prefs;

      // 1. Decrement remainingSec
      remainingSec--;

      // 2. ALWAYS update storage and badge with the new remainingSec.
      chrome.storage.local.set({ remainingSec }, () => {
          updateBadge(remainingSec, currentSession); // Update badge with current remainingSec (can be 0)
      });

      // 3. Check if session has ended (remainingSec is now 0 or less)
      if (remainingSec <= 0) {
        // session ended
        chrome.storage.local.set({ timerRunning: false }); // Temporarily set to false, will be re-enabled by startTimer()
        clearAlarm();
        playBell();
        notifyEndOfSession(currentSession);

        // determine next session
        let nextSession = 'focus';
        let nextCount = sessionCount;
        if (currentSession === 'focus') {
          nextCount++;
          nextSession = (nextCount % sessionsBeforeLong === 0) ? 'longBreak' : 'shortBreak';
        }
        // reset for next
        const nextDurMin = prefs[nextSession];
        chrome.storage.local.set({
          currentSession: nextSession,
          sessionCount: nextCount,
          remainingSec: nextDurMin * 60 // Set remainingSec for the *new* session
        }, () => {
            updateBadge(nextDurMin * 60, nextSession); // Update badge for the new session
            startTimer(); // NEW: Automatically start the next session!
        });
      }
    });
  } catch (e) {
    console.error("Error in ALARM tick handler:", e);
  }
});


// ────────────────────────────────────────────────────────────
//  Timer Control Helpers
// ────────────────────────────────────────────────────────────
function startTimer() {
  chrome.storage.local.get(['timerRunning','remainingSec','currentSession','focus','shortBreak','longBreak'], prefs => {
    if (prefs.timerRunning) return;
    // if we just reset or never started, ensure remainingSec is set
    if (prefs.remainingSec <= 0) {
      const durMin = prefs[prefs.currentSession];
      prefs.remainingSec = durMin * 60;
      chrome.storage.local.set({ remainingSec: prefs.remainingSec });
    }
    chrome.storage.local.set({ timerRunning: true });
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1/60 });
  });
}

function pauseTimer() {
  chrome.storage.local.set({ timerRunning: false });
  clearAlarm();
}

function resetTimer() {
  // Always reset to the default focus session values
  chrome.storage.local.get(['focus'], prefs => {
    chrome.storage.local.set({
      timerRunning: false,
      sessionCount: 0,
      currentSession: 'focus',
      remainingSec: prefs.focus * 60
    }, () => {
      clearAlarm();
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff5722' });
    });
  });
}

// Function to skip to the next session
function skipToNextSession() {
  chrome.storage.local.get([
    'currentSession', 'sessionCount', 'sessionsBeforeLong',
    'focus', 'shortBreak', 'longBreak', 'timerRunning'
  ], prefs => {
    let { currentSession, sessionCount, sessionsBeforeLong, timerRunning } = prefs;

    // Clear any running alarm and pause the timer
    clearAlarm();
    if (timerRunning) {
      chrome.storage.local.set({ timerRunning: false });
    }

    let nextSession = 'focus';
    let nextCount = sessionCount;

    if (currentSession === 'focus') {
      nextCount++;
      nextSession = (nextCount % sessionsBeforeLong === 0) ? 'longBreak' : 'shortBreak';
    } else if (currentSession === 'shortBreak') {
      nextSession = 'focus';
    } else if (currentSession === 'longBreak') {
      // If currently in long break, and skipping, it should reset to focus
      // and the button should be disabled as per requirement.
      // This case should ideally not be reachable if the button is disabled.
      // However, as a safeguard, we can reset to focus.
      nextSession = 'focus';
      nextCount = 0; // Reset session count after a long break
    }

    const nextDurMin = prefs[nextSession];
    chrome.storage.local.set({
      currentSession: nextSession,
      sessionCount: nextCount,
      remainingSec: nextDurMin * 60,
      timerRunning: false // Ensure timer is paused after skipping
    }, () => {
      updateBadge(nextDurMin * 60, nextSession);
      // If the timer was running, start the new session automatically
      if (timerRunning) {
        startTimer();
      }
    });
  });
}

function clearAlarm() {
  chrome.alarms.clear(ALARM_NAME);
}

// ────────────────────────────────────────────────────────────
//  UI Feedback: Badge, Notification, Sound
// ────────────────────────────────────────────────────────────
function updateBadge(sec, session) {
  const mins = Math.ceil(sec / 60).toString();
  chrome.action.setBadgeText({ text: mins });
  chrome.action.setBadgeBackgroundColor({
    color: session === 'focus' ? '#ff5722' : '#4caf50'
  });
}

function notifyEndOfSession(session) {
  const title = session === 'focus' ? 'Focus session complete!' : 'Break is over!';
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/clock-48.png',
    title,
    message: session === 'focus'
      ? 'Time for a short/long break ☕'
      : 'Back to work! 🎯'
  });
}

// MODIFIED playBell function to use offscreen document
async function playBell() {
  await setupOffscreenDocument(); // Ensure offscreen document is ready
  chrome.runtime.sendMessage({
    type: 'playAudio',
    src: chrome.runtime.getURL('/sounds/ding-ding-small-bell.mp3') // Correct path to your sound file
  });
}

// NEW: Function to manage the offscreen document
let offscreenCreating; // A promise to avoid multiple creation attempts

async function setupOffscreenDocument() {
  // Check if an offscreen document is already open
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  // If not, and we're not already trying to create one, create it
  if (offscreenCreating) {
    await offscreenCreating;
  } else {
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'src/offscreen.html', // Path to your offscreen.html
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Plays alarm sound for pomodoro timer.'
    });
    await offscreenCreating;
    offscreenCreating = null; // Reset the promise after creation
  }
}