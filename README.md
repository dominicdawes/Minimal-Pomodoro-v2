# MinimalPomodoro
pomodoro_timer_open_source

## Structure of a Chrome extension

```
MinimalPomodoro-v2/
├── manifest.json         # Chrome Extension manifest (MV3)
├── background.js         # Service worker: alarms, badge updates, notifications, sound
├── content.js            # Injection of html into the DOM (enabling control of rounded corners and shadows) 
├── popup.html            # Extension popup UI
├── popup.css             # Styles, theming (light/dark) and shadows
├── popup.js              # Popup logic: controls, storage, messaging
├── icons/                # Toolbar and notification icons
│   ├── clock-16.png
│   ├── clock-48.png
│   └── clock-128.png
└── sounds/               # Notification bell sound
    └── bell.mp3
```

## ⚙️ Prerequisites

Chrome (or Edge) installed for local testing

(optional) Node.js & npm if you plan to add a build step (bundlers, preprocessors)


## 🚀 Local Testing in Chrome

Open Chrome and navigate to chrome://extensions.  (in Edge -> edge://extensions)

Enable Developer mode (toggle in top-right).

Click Load unpacked and select the MinimalPomodoro/ folder.

The extension should appear in your toolbar. Click the icon to open the popup UI.

Use Inspect popup (right-click inside) and Inspect service worker (via chrome://extensions → Details → Service worker) to debug logs and watch badge updates.

After making code edits, click the Reload (🔄) button on your extension card to pick up changes.


## 🛠️ Development Tips

Auto‑reload: Consider adding the Extension Reloader to your manifest for hot‑reload on file changes.

Bundling: If you want to use modern ES modules, SCSS, or Tailwind, set up a simple Webpack or esbuild pipeline:

```
npm init -y
npm install --save-dev esbuild
# add build scripts in package.json, e.g.:
# "build": "esbuild src/*.js --outdir=../MinimalPomodoro/"
```


## 📦 Packaging & Publishing

Zip the contents of the MinimalPomodoro/ folder (exclude node_modules/ if present).

Create a Chrome Web Store Developer account: https://chrome.google.com/webstore/developer/dashboard

Click Add new item, upload your ZIP, and fill in the extension listing details (description, screenshots, categories).

Submit for review; once approved, your extension will auto‑update for users as you publish new versions.


## 🎉 Usage

Click the toolbar icon to open the Pomodoro popup.

Adjust Focus and Break durations via sliders.

Use Start, Skip, or Reset buttons to control the timer.

Watch the badge countdown (MMSS) on the icon across all tabs.

Listen for a bell sound and see a desktop notification when sessions end.

Toggle light/dark mode with the switch in the popup header.


## 🤝 Contributing

Bug reports, feature requests, and pull requests are welcome! Please fork the repo, branch off your feature, and submit a PR.


## 📝 License

This project is open source under the MIT License. See LICENSE for details.