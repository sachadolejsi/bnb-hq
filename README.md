# B&B CO. HQ

The business app for B&B CO., as an installable web app (PWA).

- Hosting: GitHub Pages (this repository)
- Sign-in and data: Firebase Authentication (Google) + Cloud Firestore
- All business data lives in Firestore under `businesses/bnb/…`, protected by security rules. **No client data is stored in this repository.**

## Files
- `index.html`: the app
- `firebase-shim.js`: connects the app to Firebase (sign-in, database, receipts, downloads)
- `sw.js` + `manifest.webmanifest` + `icons/`: make it installable and work offline

## Updating
Replace the changed files in this repository. GitHub Pages republishes in about a minute.
