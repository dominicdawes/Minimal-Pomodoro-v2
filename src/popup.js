// popup.js
// this file does popup logic: controls, storage, messaging,
// reads stored states, and updates the timer donut clock

// ────────────────────────────────────────────────────────────
//  DOM Refs
// ────────────────────────────────────────────────────────────
const timeDisplay     = document.getElementById('time-display');
const sessionLabel    = document.getElementById('session-label');
const donutProgress   = document.querySelector('#donut .progress');
const statusDiv       = document.getElementById('status-indicators');
const btnStartPause   = document.getElementById('btn-start-pause');
const btnReset        = document.getElementById('btn-reset');
const btnSkipFwd      = document.getElementById('btn-skip-fwd');

// Views
const viewTimer       = document.getElementById('view-timer');
const viewSettings    = document.getElementById('view-settings');
const viewAdjust      = document.getElementById('view-adjust');

// Buttons for navigation and settings
const btnSettings       = document.getElementById('btn-settings'); // In Timer view footer
const btnCloseSettings  = document.getElementById('btn-close-settings'); // In Settings view header
const btnBackSettings     = document.getElementById('btn-back-settings');   // In Settings view header (typo? btnBackAdjust is also used)
const btnBackAdjust     = document.getElementById('btn-back-adjust');   // In Adjust view header
const settingItems    = document.querySelectorAll('.setting-item');

// Labels for settings values in the list
const labels = {
  focus: document.getElementById('label-focus'),
  shortBreak: document.getElementById('label-shortBreak'),
  longBreak: document.getElementById('label-longBreak'),
  sessionsBeforeLong: document.getElementById('label-sessionsBeforeLong'),
};

// Adjust view elements
const adjustTitle = document.getElementById('adjust-title');
const adjustInput = document.getElementById('adjust-input');
const adjustUnit = document.getElementById('adjust-unit');
const btnDecrease = document.getElementById('decrease');
const btnIncrease = document.getElementById('increase');

// ────────────────────────────────────────────────────────────
//  State
// ────────────────────────────────────────────────────────────
let settings = {};
let currentAdjustingKey = ''; // The key of the setting being adjusted (e.g., 'focus', 'shortBreak')

// ────────────────────────────────────────────────────────────
//  Event Listeners
// ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Request initial settings from content.js
    document.getElementById('app').dispatchEvent(new CustomEvent('popupReadyForSettings', {
        detail: {
            keys: ['focus', 'shortBreak', 'longBreak', 'sessionsBeforeLong', 'currentSession', 'sessionCount', 'remainingSec', 'timerRunning']
        }
    }));
});

// Listener for initial settings from content.js
document.getElementById('app').addEventListener('initialExtensionSettings', (event) => {
    settings = event.detail;
    updateUI();
    console.log('Initial settings loaded:', settings);
});

// Listener for real-time storage updates from content.js
document.getElementById('app').addEventListener('extensionStorageUpdate', (event) => {
    const updatedSettings = event.detail;
    console.log('Storage updated via content.js:', updatedSettings);
    Object.assign(settings, updatedSettings); // Merge new settings
    updateUI();
});

btnStartPause.addEventListener('click', toggleTimer);
btnReset.addEventListener('click', resetTimer);
btnSkipFwd.addEventListener('click', skipSession);

btnSettings.addEventListener('click', () => switchView('settings'));
btnCloseSettings.addEventListener('click', () => switchView('timer'));
btnBackAdjust.addEventListener('click', () => switchView('settings'));

settingItems.forEach(item => {
  item.addEventListener('click', (e) => {
    const key = item.dataset.key;
    if (key) {
      currentAdjustingKey = key;
      showAdjustView(key);
    }
  });
});

btnDecrease.addEventListener('click', () => adjustValue(-1));
btnIncrease.addEventListener('click', () => adjustValue(1));
adjustInput.addEventListener('change', (e) => {
  const value = parseInt(e.target.value, 10);
  if (!isNaN(value)) {
    saveSetting(currentAdjustingKey, value);
  }
});


// ────────────────────────────────────────────────────────────
//  View Management
// ────────────────────────────────────────────────────────────
function switchView(viewName) {
  viewTimer.classList.remove('active');
  viewSettings.classList.remove('active');
  viewAdjust.classList.remove('active');

  if (viewName === 'timer') {
    viewTimer.classList.add('active');
  } else if (viewName === 'settings') {
    viewSettings.classList.add('active');
    updateSettingsLabels();
  } else if (viewName === 'adjust') {
    viewAdjust.classList.add('active');
  }
}

function showAdjustView(key) {
  adjustTitle.textContent = labelCase(key) + ' Session';
  adjustInput.value = settings[key];
  adjustUnit.textContent = key === 'sessionsBeforeLong' ? 'Sess.' : 'min';
  switchView('adjust');
}

// ────────────────────────────────────────────────────────────
//  Storage Interaction (via Message Passing to content.js)
// ────────────────────────────────────────────────────────────

function getSettings(keys, callback) {
    chrome.runtime.sendMessage({ action: "getSettings", keys: keys }, (response) => {
        if (response && response.settings) {
            callback(response.settings);
        } else {
            console.error("Failed to get settings from content.js");
            callback({});
        }
    });
}

function saveSetting(key, value) {
    chrome.runtime.sendMessage({ action: "saveSetting", key: key, value: value }, (response) => {
        if (response && response.success) {
            console.log(`Setting ${key} saved: ${value}`);
            settings[key] = value; // Update local state immediately for responsiveness
            updateUI();
        } else {
            console.error(`Failed to save setting ${key}`);
        }
    });
}

// ────────────────────────────────────────────────────────────
//  Timer Control (via Message Passing to background.js)
// ────────────────────────────────────────────────────────────

function toggleTimer() {
    const action = settings.timerRunning ? "pauseTimer" : "startTimer";
    chrome.runtime.sendMessage({ action: action }, (response) => {
        if (response && response.timerRunning !== undefined) {
            settings.timerRunning = response.timerRunning;
            updateUI();
        } else {
            console.error("Failed to toggle timer:", response);
        }
    });
}

function resetTimer() {
    chrome.runtime.sendMessage({ action: "resetTimer" }, (response) => {
        if (response && response.success) {
            console.log("Timer reset.");
            // Assuming resetTimer also sends back the new state, or we fetch it
            getSettings(['remainingSec', 'currentSession', 'sessionCount', 'timerRunning'], (updated) => {
                Object.assign(settings, updated);
                updateUI();
            });
        } else {
            console.error("Failed to reset timer.");
        }
    });
}

function skipSession() {
    chrome.runtime.sendMessage({ action: "skipSession" }, (response) => {
        if (response && response.success) {
            console.log("Session skipped.");
            // Fetch updated state after skipping
            getSettings(['remainingSec', 'currentSession', 'sessionCount', 'timerRunning'], (updated) => {
                Object.assign(settings, updated);
                updateUI();
            });
        } else {
            console.error("Failed to skip session.");
        }
    });
}

// ────────────────────────────────────────────────────────────
//  UI Updates
// ────────────────────────────────────────────────────────────

function updateUI() {
    if (!settings.remainingSec) return; // Wait for settings to load

    timeDisplay.textContent = formatTime(settings.remainingSec);
    sessionLabel.textContent = labelCase(settings.currentSession);

    // Update donut progress
    const totalSec = settings[settings.currentSession] * 60;
    const progress = (settings.remainingSec / totalSec) * 100;
    donutProgress.style.strokeDashoffset = 314 - (314 * progress) / 100;

    // Update start/pause button text
    btnStartPause.textContent = settings.timerRunning ? 'PAUSE' : 'START';

    // Update status dots
    renderStatusDots(settings.sessionCount, settings.sessionsBeforeLong);

    // Update settings labels if settings view is active
    if (viewSettings.classList.contains('active')) {
      updateSettingsLabels();
    }
}

function updateSettingsLabels() {
  labels.focus.textContent = `${settings.focus} min`;
  labels.shortBreak.textContent = `${settings.shortBreak} min`;
  labels.longBreak.textContent = `${settings.longBreak} min`;
  labels.sessionsBeforeLong.textContent = `${settings.sessionsBeforeLong} Sess.`;
}

function adjustValue(delta) {
  let currentValue = parseInt(adjustInput.value, 10);
  const minVal = parseInt(adjustInput.min, 10) || 1;
  currentValue = isNaN(currentValue) ? minVal : currentValue + delta;
  if (currentValue < minVal) {
    currentValue = minVal;
  }
  adjustInput.value = currentValue;
  adjustInput.dispatchEvent(new Event('change')); // Trigger change to save
}

// ────────────────────────────────────────────────────────────
//  UI Helpers
// ────────────────────────────────────────────────────────────
function formatTime(sec) {
  const m = String(Math.floor(sec/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${m}:${s}`;
}

function labelCase(key) {
  if (!key) return 'FOCUS'; // Default if key is undefined
  return key
    .replace(/([A-Z])/g, ' $1')
    .toUpperCase()
    .trim();
}

function renderStatusDots(count, cycleLen) {
  if (!statusDiv) return;
  statusDiv.innerHTML = '';
  if (typeof count !== 'number' || typeof cycleLen !== 'number') {
    // console.warn("Invalid count or cycleLen for renderStatusDots:", count, cycleLen);
    return;
  }

  for (let i = 0; i < cycleLen; i++) {
    const dot = document.createElement('span');
    dot.classList.add('dot');
    if (i < count) {
      dot.classList.add('completed');
    }
    statusDiv.appendChild(dot);
  }
}