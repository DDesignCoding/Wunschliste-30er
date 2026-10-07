/* =====================================================
   1) DEINE GESCHENKE – hier einfach anpassen
   ===================================================== */
const CATEGORIES = [
  { id: "buecher", title: "Bücher" },
  { id: "andere",  title: "Andere Geschenke" },
];

const GIFTS = [
  { id: "buch-1",   category: "buecher", name: "Buch 1",   price: 25 },
  { id: "buch-2",   category: "buecher", name: "Buch 2",   price: 25 },
  { id: "buch-3",   category: "buecher", name: "Buch 3",   price: 25 },
  { id: "buch-4",   category: "buecher", name: "Buch 4",   price: 25 },
  { id: "anderes-1", category: "andere", name: "Anderes 1", price: 25 },
  { id: "anderes-2", category: "andere", name: "Anderes 2", price: 25 },
  { id: "anderes-3", category: "andere", name: "Anderes 3", price: 25 },
  { id: "anderes-4", category: "andere", name: "Anderes 4", price: 25 },
];

/* =====================================================
   2) FIREBASE-ZUGANGSDATEN – siehe Anleitung
   Solange hier "DEIN_..." steht, läuft die Seite im Demo-Modus
   (Haken werden nur in DIESEM Browser gespeichert).
   ===================================================== */
const FIREBASE_CONFIG = {
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  projectId: "DEIN_PROJEKT",
  appId: "DEIN_APP_ID",
};

/* =====================================================
   3) Ab hier muss nichts mehr geändert werden
   ===================================================== */
const listsEl  = document.getElementById("lists");
const statusEl = document.getElementById("status");
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const checked = new Map();                 // id -> true/false (gemeinsamer Stand)
const mine = loadMine();                   // Geschenke, die DIESER Besucher abgehakt hat
const itemEls = new Map();                 // id -> <li>
const listEls = new Map();                 // categoryId -> <ul>

let saveChecked = null;                    // wird je nach Modus gesetzt

function loadMine() {
  try { return new Set(JSON.parse(localStorage.getItem("wishlist-mine") || "[]")); }
  catch { return new Set(); }
}
function storeMine() {
  try { localStorage.setItem("wishlist-mine", JSON.stringify([...mine])); } catch {}
}

/* ---------- Aufbau ---------- */
function build() {
  CATEGORIES.forEach((cat, i) => {
    const section = document.createElement("section");
    section.className = "category";
    section.innerHTML = `<h2 class="category-title"><span class="badge">${i + 1}</span>${cat.title}</h2>`;
    const ul = document.createElement("ul");
    ul.className = "items";
    section.appendChild(ul);
    listsEl.appendChild(section);
    listEls.set(cat.id, ul);
  });

  GIFTS.forEach((g) => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="item-top">
        <span class="item-name"></span>
        <span class="item-price"></span>
      </div>
      <label class="check">
        <input type="checkbox">
        <span class="check-label">Das will ich schenken</span>
      </label>`;
    li.querySelector(".item-name").textContent = g.name;
    li.querySelector(".item-price").textContent = euro.format(g.price);
    li.querySelector("input").addEventListener("change", (e) => onToggle(g.id, e.target));
    itemEls.set(g.id, li);
  });
}

/* ---------- Anzeige aktualisieren (mit weicher Verschiebe-Animation) ---------- */
function render() {
  const before = new Map();
  itemEls.forEach((el, id) => before.set(id, el.getBoundingClientRect().top));

  CATEGORIES.forEach((cat) => {
    const ul = listEls.get(cat.id);
    const items = GIFTS.filter((g) => g.category === cat.id);
    // Nicht abgehakte zuerst, abgehakte nach unten (Reihenfolge sonst wie im Array)
    items.sort((a, b) => Number(!!checked.get(a.id)) - Number(!!checked.get(b.id)));
    items.forEach((g) => {
      const li = itemEls.get(g.id);
      const done = !!checked.get(g.id);
      const input = li.querySelector("input");
      li.classList.toggle("done", done);
      li.classList.toggle("mine", done && mine.has(g.id));
      input.checked = done;
      // Fremde Haken sind gesperrt, eigene kann man wieder zurücknehmen
      input.disabled = done && !mine.has(g.id);
      li.querySelector(".check-label").textContent =
        done && !mine.has(g.id) ? "Wird schon geschenkt 🎁" : done ? "Du schenkst das ✓" : "Das will ich schenken";
      ul.appendChild(li);
    });
  });

  // FLIP: von alter zu neuer Position gleiten
  itemEls.forEach((el, id) => {
    const dy = before.get(id) - el.getBoundingClientRect().top;
    if (!dy) return;
    el.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  });
}

/* ---------- Klick ---------- */
function onToggle(id, input) {
  const value = input.checked;
  if (value) mine.add(id); else mine.delete(id);
  storeMine();
  checked.set(id, value);
  render();
  saveChecked(id, value).catch(() => {
    showStatus("Speichern hat nicht geklappt. Bitte Seite neu laden und nochmal versuchen.");
    checked.set(id, !value);
    if (value) mine.delete(id); else mine.add(id);
    storeMine();
    render();
  });
}

function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = false;
}

/* ---------- Modus 1: Demo (nur lokal) ---------- */
function startLocalMode() {
  const KEY = "wishlist-demo";
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    Object.entries(saved).forEach(([id, v]) => checked.set(id, v));
  } catch {}
  saveChecked = async (id, value) => {
    const obj = Object.fromEntries(checked);
    obj[id] = value;
    localStorage.setItem(KEY, JSON.stringify(obj));
  };
  showStatus("Demo-Modus: Haken werden nur in deinem Browser gespeichert. Datenbank noch nicht verbunden.");
  render();
}

/* ---------- Modus 2: Firebase (für alle Besucher) ---------- */
async function startFirebaseMode() {
  const V = "10.12.0";
  const [{ initializeApp }, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const db = fs.getFirestore(initializeApp(FIREBASE_CONFIG));

  saveChecked = (id, value) => fs.setDoc(fs.doc(db, "gifts", id), { checked: value });

  // Live-Updates: ändert jemand etwas, sieht man es sofort
  fs.onSnapshot(
    fs.collection(db, "gifts"),
    (snap) => {
      snap.docChanges().forEach((c) => {
        checked.set(c.doc.id, c.type === "removed" ? false : !!c.doc.data().checked);
      });
      render();
    },
    () => showStatus("Verbindung zur Datenbank fehlgeschlagen.")
  );
  render();
}

/* ---------- Start ---------- */
build();
const configured = !FIREBASE_CONFIG.apiKey.startsWith("DEIN_");
if (configured) {
  startFirebaseMode().catch(() => startLocalMode());
} else {
  startLocalMode();
}
