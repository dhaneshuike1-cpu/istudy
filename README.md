# iStudy — Study Timer and Tracker

A responsive React/Vite web app with a 60-minute study timer, automatic 15-minute breaks, daily statistics, subject-wise tracking, a seven-day chart, and local browser storage.

## Requirements
- Node.js 20 or newer (LTS recommended)
- VS Code (recommended)

## Run on your laptop
1. Install Node.js from https://nodejs.org/
2. Extract this project folder.
3. Open the `istudy` folder in VS Code.
4. Open Terminal → New Terminal.
5. Run:
   ```bash
   npm install
   npm run dev
   ```
6. Open the local URL printed in the terminal, usually `http://localhost:5173`.

## Use on Android
For testing on the same Wi-Fi:
1. Run `npm run dev -- --host 0.0.0.0`.
2. Find your laptop's local IPv4 address with `ipconfig`.
3. On your phone, open `http://LAPTOP-IP:5173` while both devices are on the same Wi-Fi.
4. For a permanent installable Android experience, deploy the built app to HTTPS hosting and use Chrome's menu → Add to Home screen / Install app.

The included web manifest gives the app install metadata. For a production PWA, add service-worker/offline support and real icon files; these are not included in this starter.

## Build
```bash
npm run build
npm run preview
```

## How the timer works
- Start a 60-minute study block.
- When it reaches zero, the app records a completed study block and automatically starts a 15-minute break.
- When the break reaches zero, another 60-minute study block starts automatically.
- Pause and resume preserve the remaining time. Reset returns to a fresh study block.
- The timer uses an end timestamp, so it catches up when a browser tab sleeps or the app is backgrounded.

## Current limitations
- History is saved in `localStorage` on this browser/device. It does not sync between devices yet.
- Browser notifications require permission and may be restricted when the app is backgrounded. Reliable Android background alerts need a production PWA/service worker or a native Android wrapper.
- The chart counts completed sessions; partially completed sessions are only recorded if you use “Skip to next phase.”
- Subjects are kept in app state for the current run; custom subject names are selected in the current UI but the subject list itself is not yet persisted across reloads.
