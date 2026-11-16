# B&B CO. HQ: guide for Claude

Business app for B&B CO., a lawn and property services business in Toronto. The owner isn't a programmer, so explain changes in plain language and keep them small and safe.

## How it's built
- **Hosting:** GitHub Pages, from the `main` branch, root folder. Live at https://sachadolejsi.github.io/bnb-hq/. Merging to `main` publishes within about a minute.
- **No build step.** Plain HTML, CSS and JavaScript. No npm, no framework, no bundler. Keep it that way unless the owner agrees otherwise.
- **`index.html`** holds the whole app: styles in `<style>`, markup, then one big inline `<script>` wrapped in an IIFE. Sections are marked with comments like `// ---------- JOBS ----------`.
- **`firebase-shim.js`** (ES module) connects the app to Firebase: Google sign-in through Auth, and Firestore with an offline cache. It exposes `window.claude.use(name)`:
  - `use('db')` gives a small document API: `db.doc('coll/id').set/update/delete/get/onSnapshot` and `db.collection('coll').limit(n).onSnapshot`. Paths are relative. The shim prefixes them with `businesses/bnb/`.
  - `use('downloads')` gives `save({filename, data})`, which triggers a browser download.
  - `use('assets')` handles receipts: photos are shrunk to JPEG and stored as data URLs in `businesses/bnb/receipts/{id}`.
  - The app was first built as a Claude artifact. The shim keeps that API so the app code didn't need rewriting. Don't call Firebase directly from `index.html`; add to the shim instead.
- **`sw.js`** is the service worker. The app shell is network-first; libraries and fonts are cached. **Bump `CACHE` (for example `bnb-hq-v2`) whenever `sw.js` logic or the cached file list changes.**
- **`manifest.webmanifest`** and **`icons/`** make it installable (PWA).
- Libraries come from CDNs: jsPDF from cdnjs (invoice and quote PDFs), Firebase 10.12.2 from gstatic, Google Fonts.

## Data model (Firestore, under `businesses/bnb/`)
- `clients/{id}`: name, address, phone, email, frequency (weekly | biweekly | monthly | oncall | none), mowPrice, frontPrice, mowMinutes, pay (each | monthend | plan), bwGroup (A | B), route, active, notes, nextPrice, importedMows, importedMowRevenue
- `weeks/{YYYY-MM-DD Monday}`: entries {clientId: {amount, paid, date, name, address, front, invoiceId}}, carry [ids], moved [ids]. One doc per week holds all mows.
- `jobs/{id}`: date, clientId, clientName, address, service, amount, hours, paid, kind (project | sub | mow-import), invoiceId, notes
- `quotes/{id}` and `invoices/{id}`: number (Q-0001 / INV-0001), date, due or validDays, clientId, clientName, address, items [{desc, qty, rate}], taxRate, status, notes, campaign, refs (invoices: the mows and jobs they cover)
- `expenses/{id}`: date, category, description, amount, receipt, receiptType
- `crew/{id}` and `shifts/{id}`: workers and logged hours. Paying a worker creates a Labour expense.
- `weekplans/{Monday}`: days {clientId: dow 0=Mon..6=Sun}, focus
- `settings/business`: business details, taxRate, goals, weeklyGoal, targetRate, calc (quote calculator rates), pin (hashed passcode)
- `receipts/{id}`: data (data URL), type
- Week groups: a week is "A" when the number of whole weeks from 2026-01-05 to its Monday is even.

## Security
- Firestore rules live in the Firebase console, not in this repo. Only members listed in `businesses/bnb.members` can read or write. Never weaken rules, and never put client data in this repo. It's **public**.
- The Firebase web config in `firebase-shim.js` is meant to be public. Never add service-account keys or other secrets.

## Working rules
- Make small, focused changes. Explain what changed and how to check it in the app.
- Preserve existing data shapes. When adding a field, handle old records that don't have it.
- Test before pushing: open `index.html` with a local server and check there are no console errors. Mock Firebase if needed.
- The owner prefers a short summary first, then detail. Tell them directly if an idea is risky.
