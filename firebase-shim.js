// Firebase bridge: gives the HQ app the same tiny data API it uses inside Claude
// (claude.use('db' | 'downloads' | 'assets')), backed by Firebase Auth + Firestore.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, query, limit, setDoc, deleteDoc, getDoc, updateDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC5BEl5l7aR0NaeAXM5cqCl_RYYJpX8PoQ',
  authDomain: 'bnb-hq-4b47c.firebaseapp.com',
  projectId: 'bnb-hq-4b47c',
  storageBucket: 'bnb-hq-4b47c.firebasestorage.app',
  messagingSenderId: '775797561146',
  appId: '1:775797561146:web:bf1390b0d4b340ca1c6203'
};
const BIZ = 'bnb';                         // business id: all data lives under businesses/bnb/...

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let fs;
try { fs = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { fs = initializeFirestore(app, { ignoreUndefinedProperties: true }); }

const CODE = { 'permission-denied': 'invalid_argument', 'unavailable': 'unavailable', 'resource-exhausted': 'resource_exhausted', 'unauthenticated': 'revoked', 'invalid-argument': 'invalid_argument' };
const code = e => CODE[e && e.code] || 'unavailable';
const fail = e => { const er = new Error((e && e.message) || 'Firestore error'); er.code = code(e); throw er; };
const P = p => `businesses/${BIZ}/${p}`;
const snapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites } });

const db = {
  doc(path) {
    const ref = doc(fs, P(path));
    return {
      id: ref.id, path,
      set: d => setDoc(ref, d).catch(fail),
      update: d => updateDoc(ref, d).catch(fail),
      delete: () => deleteDoc(ref).catch(fail),
      get: async () => snapDoc(await getDoc(ref).catch(fail)),
      onSnapshot: (next, err) => onSnapshot(ref, s => next(snapDoc(s)), e => err && err({ code: code(e), message: e.message }))
    };
  },
  collection(c) {
    const base = collection(fs, P(c));
    const wrap = q => ({
      onSnapshot: (next, err) => onSnapshot(q, s => next({ docs: s.docs.map(d => ({ id: d.id, exists: true, data: () => d.data(), metadata: {} })), size: s.size, empty: s.empty, docChanges: () => [], metadata: { fromCache: s.metadata.fromCache } }), e => err && err({ code: code(e), message: e.message })),
      limit: k => wrap(query(base, limit(k)))
    });
    return wrap(base);
  }
};

const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { status: 'saved' };
  }
};

// Receipts: photos are shrunk to a light JPEG and stored in Firestore (no paid Storage plan needed).
const readAsDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function shrink(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > 700 * 1024) { const e = new Error('too large'); e.code = 'too_large'; throw e; }
    return { data: await readAsDataURL(file), type: 'application/pdf' };
  }
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.75, url = c.toDataURL('image/jpeg', q);
  while (url.length > 850000 && q > 0.3) { q -= 0.15; url = c.toDataURL('image/jpeg', q); }
  return { data: url, type: 'image/jpeg' };
}
const assets = {
  async upload(file) {
    const { data, type } = await shrink(file);
    const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await setDoc(doc(fs, P('receipts/' + id)), { data, type, createdAt: new Date().toISOString() }).catch(fail);
    return { id, url: data, sizeBytes: data.length, contentType: type };
  },
  async delete(id) { await deleteDoc(doc(fs, P('receipts/' + id))).catch(fail); return { deleted: true }; },
  async list() { return { assets: [], usage: {} }; }
};
const blobCache = {};
async function receiptBlobUrl(id) {
  if (blobCache[id]) return blobCache[id];
  const s = await getDoc(doc(fs, P('receipts/' + id)));
  const d = s.exists() ? s.data().data : null; if (!d) return null;
  const blob = await (await fetch(d)).blob();
  return (blobCache[id] = URL.createObjectURL(blob));
}
window.__receiptSrc = () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
window.__fillReceipts = root => (root || document).querySelectorAll('[data-receipt]').forEach(async el => {
  try { const u = await receiptBlobUrl(el.dataset.receipt); if (!u) return; if (el.tagName === 'IMG') el.src = u; else el.href = u; } catch (e) {}
});
window.__signOut = () => signOut(auth).then(() => location.reload());

// ---------- sign-in gate ----------
const gate = document.getElementById('gate'), gMsg = document.getElementById('gateMsg'), gBtn = document.getElementById('gateBtn'), gOut = document.getElementById('gateOut');
const showGate = (msg, signedIn) => { gMsg.textContent = msg; gBtn.hidden = !!signedIn; gOut.hidden = !signedIn; gate.hidden = false; };
gBtn.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  gMsg.textContent = 'Opening Google sign-in…';
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) { try { await signInWithRedirect(auth, provider); } catch (e2) { gMsg.textContent = 'Sign-in failed: ' + (e2.code || e2.message); } }
    else if (e.code === 'auth/popup-closed-by-user') gMsg.textContent = 'Sign-in was closed. Tap the button to try again.';
    else if (e.code === 'auth/unauthorized-domain') gMsg.textContent = 'This web address isn\'t approved in Firebase yet. Add it under Authentication → Settings → Authorized domains.';
    else gMsg.textContent = 'Sign-in failed: ' + (e.code || e.message);
  }
});
gOut.addEventListener('click', () => window.__signOut());
getRedirectResult(auth).catch(e => { if (e && e.code) gMsg.textContent = 'Sign-in failed: ' + e.code; });

async function ensureMember(user) {
  const ref = doc(fs, `businesses/${BIZ}`);
  try { const s = await getDoc(ref); if (s.exists() && (s.data().members || []).includes(user.uid)) return; } catch (e) { /* not readable yet: may not exist */ }
  // Only the owner's Google account can create the business record (enforced by the Firestore security rules).
  await setDoc(ref, { name: 'B&B CO.', owner: user.uid, members: [user.uid], createdAt: new Date().toISOString() });
}
let resolveReady; const ready = new Promise(r => resolveReady = r);
onAuthStateChanged(auth, async user => {
  if (!user) { showGate('Sign in with your Google account to open your business.'); return; }
  try { await ensureMember(user); gate.hidden = true; resolveReady(); }
  catch (e) { showGate(`${user.email} doesn't have access to this business. Sign out and use the owner's account.`, true); }
});

window.__fbResolve({
  async use(name) {
    if (name === 'db') { await ready; return db; }
    if (name === 'assets') { await ready; return assets; }
    if (name === 'downloads') return downloads;
    return null;
  }
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
