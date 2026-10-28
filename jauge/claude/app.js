'use strict';

/* =========================================================
   Mon Budget — appli perso, 100 % locale (localStorage)
   ========================================================= */

const STORE_KEY = 'mon-budget-v1';
const PALETTE_SIZE = 8; // couleurs de catégories --c1 … --c8

/* ---------- Utilitaires ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtEur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const money = (n) => fmtEur.format(round2(n));
const money0 = (n) => fmtEur0.format(Math.round(n));
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseAmt = (s) => {
  const n = parseFloat(String(s ?? '').replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) ? round2(n) : NaN;
};
const amtInput = (n) => (Number.isFinite(n) ? String(round2(n)).replace('.', ',') : '');

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthOf = (iso) => iso.slice(0, 7);
const currentMonth = () => monthOf(todayISO());
const shiftMonth = (mk, delta) => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const daysInMonth = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const monthName = (mk, opts = { month: 'long', year: 'numeric' }) => {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', opts);
};
const dayLabel = (iso) => {
  if (iso === todayISO()) return "Aujourd'hui";
  const d = new Date(iso + 'T12:00:00');
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

/* ---------- Données par défaut ---------- */
function defaultState() {
  return {
    version: 1,
    settings: { theme: 'auto', savingsTarget: 100 },
    recurring: [
      { id: 'salaire', name: 'Salaire', icon: '💼', kind: 'gain', certainty: 'sure', min: 1235.15, max: 1235.15, note: '' },
      { id: 'mobili', name: 'Mobili-Jeune', icon: '🏠', kind: 'gain', certainty: 'sure', min: 100, max: 100, note: '' },
      { id: 'caf', name: 'CAF', icon: '🏛️', kind: 'gain', certainty: 'sure', min: 103, max: 206, note: 'Montant variable' },
      { id: 'especes', name: 'Espèces', icon: '💵', kind: 'gain', certainty: 'unsure', min: 80, max: 200, note: 'Gain non assuré' },
      { id: 'loyer', name: 'Loyer', icon: '🔑', kind: 'perte', certainty: 'sure', min: 450, max: 450, note: '' },
      { id: 'forfait', name: 'Forfait', icon: '📱', kind: 'perte', certainty: 'sure', min: 10, max: 10, note: '' },
      { id: 'claude', name: 'Claude', icon: '🤖', kind: 'perte', certainty: 'sure', min: 21.6, max: 21.6, note: '' },
      { id: 'transport', name: 'Transport', icon: '🚆', kind: 'perte', certainty: 'sure', min: 8, max: 8, note: '16 € − 50 % remboursés par Orange' },
      { id: 'alimentaire', name: 'Alimentaire', icon: '🛒', kind: 'perte', certainty: 'sure', min: 100, max: 100, note: '' },
    ],
    categories: [
      { id: 'sorties', name: 'Restos & sorties', icon: '🍔', budget: 60, color: 1 },
      { id: 'shopping', name: 'Shopping', icon: '🛍️', budget: 50, color: 2 },
      { id: 'loisirs', name: 'Loisirs', icon: '🎮', budget: 30, color: 3 },
      { id: 'courses', name: 'Courses en plus', icon: '🥖', budget: 0, color: 4 },
      { id: 'sante', name: 'Santé', icon: '💊', budget: 0, color: 5 },
      { id: 'mobilite', name: 'Transport en plus', icon: '🚕', budget: 0, color: 6 },
      { id: 'cadeaux', name: 'Cadeaux', icon: '🎁', budget: 0, color: 7 },
      { id: 'autre', name: 'Autre', icon: '📦', budget: 0, color: 8 },
    ],
    goals: [
      { id: 'secours', name: 'Fonds de secours', icon: '🛟', target: 1000, initial: 0 },
    ],
    months: {},
  };
}

/* ---------- Stockage ---------- */
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* stockage indisponible : on repart des valeurs par défaut */ }
  return defaultState();
}
function normalize(s) {
  const d = defaultState();
  if (!s || typeof s !== 'object' || !Array.isArray(s.recurring)) throw new Error('Format invalide');
  return {
    version: 1,
    settings: { ...d.settings, ...(s.settings || {}) },
    recurring: s.recurring,
    categories: Array.isArray(s.categories) ? s.categories : d.categories,
    goals: Array.isArray(s.goals) ? s.goals : d.goals,
    months: s.months && typeof s.months === 'object' ? s.months : {},
  };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('⚠️ Impossible d’enregistrer sur cet appareil'); }
}
/** Applique une modification, enregistre, ré-affiche et propose « Annuler ». */
function commit(message, mutate, { undo = true } = {}) {
  const snapshot = JSON.stringify(state);
  mutate();
  save();
  render();
  if (message) toast(message, undo ? () => { state = JSON.parse(snapshot); save(); render(); } : null);
}

const getMonth = (mk) => state.months[mk] || { rec: {}, tx: [] };
const ensureMonth = (mk) => (state.months[mk] ||= { rec: {}, tx: [] });
const catById = (id) => state.categories.find((c) => c.id === id);
const goalById = (id) => state.goals.find((g) => g.id === id);
const recById = (id) => state.recurring.find((r) => r.id === id);
const catColor = (c) => (c && c.color >= 1 && c.color <= PALETTE_SIZE ? `var(--c${c.color})` : 'var(--text-3)');
const isRange = (r) => r.certainty === 'unsure' || r.min !== r.max;

/* ---------- Calculs ---------- */
function calc(mk) {
  const m = getMonth(mk);
  const r = {
    inPrudent: 0, inMax: 0, received: 0, pendingIn: 0, unsurePending: 0,
    fixedMax: 0, fixedMin: 0, paid: 0, pendingOut: 0,
    spent: 0, extraIn: 0, saved: 0, byCat: {},
  };
  for (const it of state.recurring) {
    const e = m.rec[it.id];
    const done = e && e.done;
    if (it.kind === 'gain') {
      if (done) { r.inPrudent += e.amount; r.inMax += e.amount; r.received += e.amount; }
      else if (it.certainty === 'sure') { r.inPrudent += it.min; r.inMax += it.max; r.pendingIn += it.min; }
      else { r.inMax += it.max; r.unsurePending += it.max; }
    } else {
      if (done) { r.fixedMax += e.amount; r.fixedMin += e.amount; r.paid += e.amount; }
      else { r.fixedMax += it.max; r.fixedMin += it.min; r.pendingOut += it.max; }
    }
  }
  for (const t of m.tx) {
    if (t.type === 'depense') { r.spent += t.amount; r.byCat[t.cat] = (r.byCat[t.cat] || 0) + t.amount; }
    else if (t.type === 'revenu') r.extraIn += t.amount;
    else if (t.type === 'epargne') r.saved += t.amount;
  }
  const target = Number(state.settings.savingsTarget) || 0;
  r.savingsLeft = Math.max(0, target - r.saved);
  // Reste à vivre prudent : revenus sûrs au minimum, charges au maximum, espèces seulement si reçues
  r.prudent = r.inPrudent + r.extraIn - r.fixedMax - r.spent - r.saved;
  r.optimist = r.inMax + r.extraIn - r.fixedMin - r.spent - r.saved;
  r.dispo = r.prudent - r.savingsLeft;               // ce qu'on peut encore dépenser
  r.libre = r.dispo + r.spent;                       // budget « plaisir » total du mois
  r.solde = r.received + r.extraIn - r.paid - r.spent - r.saved; // argent réellement passé ce mois-ci
  const cur = currentMonth();
  const dim = daysInMonth(mk);
  r.daysInMonth = dim;
  r.daysLeft = mk === cur ? dim - new Date().getDate() + 1 : mk < cur ? 0 : dim;
  r.dayIndex = mk === cur ? new Date().getDate() : mk < cur ? dim : 0;
  r.hasData = m.tx.length > 0 || Object.values(m.rec).some((e) => e.done);
  return r;
}

/** Théorie : reste mensuel selon les montants récurrents (sans dépenses variables). */
function theory(overrides = {}) {
  let inc = 0, out = 0;
  for (const it of state.recurring) {
    const v = it.id in overrides ? overrides[it.id] : it.min;
    if (it.kind === 'gain') inc += v; else out += v;
  }
  return { inc, out, net: inc - out };
}

function goalSaved(g) {
  let s = Number(g.initial) || 0;
  for (const m of Object.values(state.months)) for (const t of m.tx) if (t.type === 'epargne' && t.goal === g.id) s += t.amount;
  return round2(s);
}

/* ---------- UI : état ---------- */
const ui = { month: currentMonth(), opsFilter: 'all' };
const VIEWS = ['home', 'ops', 'goals', 'stats', 'settings'];
const currentView = () => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'home'; };

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function render() {
  applyTheme();
  const view = currentView();
  const label = $('#monthLabel');
  label.innerHTML = esc(monthName(ui.month)) + (ui.month === currentMonth() ? '' : '<span class="today-dot" title="Revenir au mois actuel"></span>');
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.view === view));
  const el = $('#view');
  el.innerHTML = ({ home: viewHome, ops: viewOps, goals: viewGoals, stats: viewStats, settings: viewSettings })[view]();
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  if (view === 'stats') bindChart();
}

/* =========================================================
   Vue : Accueil
   ========================================================= */
function viewHome() {
  const c = calc(ui.month);
  const cur = ui.month === currentMonth();
  const past = ui.month < currentMonth();
  const perDay = c.daysLeft > 0 ? Math.max(0, c.dispo) / c.daysLeft : 0;
  const pct = c.libre > 0 ? Math.min(100, (c.spent / c.libre) * 100) : (c.spent > 0 ? 100 : 0);
  const target = Number(state.settings.savingsTarget) || 0;

  let heroLabel = past ? 'Il te restait' : 'Disponible à dépenser';
  let heroSub = '';
  if (c.optimist - c.savingsLeft > c.dispo + 0.005 && !past) {
    heroSub = `Jusqu’à <b>${money(c.optimist - c.savingsLeft)}</b> dans le meilleur des cas`;
  }
  if (target > 0 && !past) heroSub += `${heroSub ? '<br>' : ''}Épargne du mois : ${money0(Math.min(c.saved, target))} / ${money0(target)} mis de côté`;

  const hero = `
    <section class="hero">
      <div class="hero-label">${heroLabel}</div>
      <div class="hero-amount num ${c.dispo < 0 ? 'neg' : ''}">${money(c.dispo)}</div>
      <div class="hero-sub">${heroSub}</div>
      <div class="hero-row">
        <div class="hero-pill"><span>${cur ? 'Par jour' : past ? 'Épargné' : 'Par jour (prévu)'}</span>
          <b class="num">${past ? money(c.saved) : money(perDay)}</b>
          <span>${cur ? `${c.daysLeft} jour${c.daysLeft > 1 ? 's' : ''} restant${c.daysLeft > 1 ? 's' : ''}` : past ? 'ce mois-là' : `${c.daysInMonth} jours`}</span></div>
        <div class="hero-pill"><span>Dépensé</span><b class="num">${money(c.spent)}</b><span>hors charges fixes</span></div>
      </div>
      <div class="hero-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Part du budget libre dépensée"><i style="width:${pct}%"></i></div>
      <div class="hero-bar-legend"><span>${Math.round(pct)} % du budget libre</span><span>${money(c.libre)}</span></div>
    </section>`;

  // Conseil / alerte de rythme
  let tip = '';
  if (cur && c.libre > 0) {
    const expected = (c.libre * c.dayIndex) / c.daysInMonth;
    if (c.dispo < 0) tip = tipCard('🚨', `Tu as dépassé ton budget de <b>${money(-c.dispo)}</b>. Pioche dans l’épargne prévue ou réduis les dépenses d’ici la fin du mois.`, 'bad');
    else if (c.spent > expected * 1.15 && c.spent > 20) tip = tipCard('🐢', `Tu dépenses un peu vite : <b>${money(c.spent)}</b> dépensés contre ~${money(expected)} attendus à ce stade du mois.`, 'warn');
    else if (c.spent > 0) tip = tipCard('🌱', `Bon rythme ! Tu es <b>${money(expected - c.spent)}</b> sous ton rythme de dépense.`, 'good');
  }

  return `
    ${hero}
    ${tip}
    <div class="tiles">
      <div class="card tile">
        <div class="k">💰 Solde du mois</div>
        <div class="v num">${money(c.solde)}</div>
        <div class="d">reçu − payé − dépensé</div>
      </div>
      <div class="card tile">
        <div class="k">⏳ Encore à recevoir</div>
        <div class="v num">${money(c.pendingIn)}</div>
        <div class="d">${c.unsurePending ? `+ jusqu’à ${money(c.unsurePending)} non assuré` : 'revenus sûrs'}</div>
      </div>
    </div>
    ${recurringCard('gain')}
    ${recurringCard('perte')}
    ${categoryBudgetsCard(c)}
  `;
}

function tipCard(icon, html, tone) {
  return `<div class="card tip" style="border-color:var(--${tone}-soft);background:var(--${tone}-soft)"><span class="e">${icon}</span><div>${html}</div></div>`;
}

function recurringCard(kind) {
  const m = getMonth(ui.month);
  const items = state.recurring.filter((r) => r.kind === kind);
  const doneCount = items.filter((r) => m.rec[r.id]?.done).length;
  const title = kind === 'gain' ? 'Rentrées du mois' : 'Charges fixes';
  const verb = kind === 'gain' ? 'reçue' : 'payée';
  const rows = items.map((r) => {
    const e = m.rec[r.id];
    const done = e?.done;
    const range = r.min === r.max ? money(r.min) : `${money0(r.min)} – ${money0(r.max)}`;
    const badge = r.certainty === 'unsure' ? '<span class="badge unsure">~</span>'
      : r.min !== r.max ? '<span class="badge range">variable</span>' : '';
    const sub = done ? `${verb === 'reçue' ? 'Reçu' : 'Payé'}${e.date ? ' le ' + new Date(e.date + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}${r.min !== r.max ? ' · prévu ' + range : ''}`
      : (r.note ? esc(r.note) : r.min === r.max ? 'En attente' : 'Prévu ' + range);
    const amt = done ? money(e.amount) : range;
    return `
      <button class="row ${done ? 'done' : ''}" data-action="rec" data-id="${esc(r.id)}">
        <span class="check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></span>
        <span class="row-icon">${esc(r.icon)}</span>
        <span class="row-main"><span class="row-title">${esc(r.name)} ${badge}</span><span class="row-sub">${sub}</span></span>
        <span class="row-amt ${kind === 'gain' ? 'amt-in' : ''} ${done ? '' : 'faint'}">${kind === 'gain' ? '+' : '−'}${amt}</span>
      </button>`;
  }).join('');
  return `
    <section class="card">
      <h3 class="card-title">${title} <small>${doneCount}/${items.length} ${verb}${items.length > 1 ? 's' : ''}</small></h3>
      <div class="list">${rows || '<div class="empty small">Rien ici. Ajoute-en dans les réglages.</div>'}</div>
    </section>`;
}

function categoryBudgetsCard(c) {
  const cats = state.categories.filter((k) => k.budget > 0 || c.byCat[k.id]);
  const unknown = Object.keys(c.byCat).filter((id) => !catById(id));
  if (!cats.length && !unknown.length) return '';
  const rows = cats.map((k) => {
    const s = c.byCat[k.id] || 0;
    const p = k.budget > 0 ? Math.min(100, (s / k.budget) * 100) : 100;
    const over = k.budget > 0 && s > k.budget;
    return `
      <div class="bar-item">
        <div class="bar-head"><span>${esc(k.icon)}</span><span class="name">${esc(k.name)}</span>
          <span class="val ${over ? 'over' : ''}">${over ? '⚠︎ ' : ''}${money(s)}${k.budget > 0 ? ' / ' + money0(k.budget) : ''}</span></div>
        <div class="track"><i style="width:${p}%;background:${over ? 'var(--bad)' : catColor(k)}"></i></div>
      </div>`;
  }).join('');
  return `
    <section class="card">
      <h3 class="card-title">Budgets par catégorie <button class="link-btn" data-action="go" data-view="settings">Modifier</button></h3>
      <div class="bars">${rows}</div>
    </section>`;
}

/* =========================================================
   Vue : Opérations
   ========================================================= */
function viewOps() {
  const m = getMonth(ui.month);
  const c = calc(ui.month);
  const f = ui.opsFilter;
  const list = m.tx.filter((t) => f === 'all' || t.type === f)
    .slice().sort((a, b) => (b.date + (b.created || '')).localeCompare(a.date + (a.created || '')));
  const groups = {};
  for (const t of list) (groups[t.date] ||= []).push(t);

  const chip = (k, l) => `<button class="chip ${f === k ? 'on' : ''}" data-action="ops-filter" data-f="${k}">${l}</button>`;
  const body = Object.keys(groups).length ? Object.entries(groups).map(([d, ts]) => {
    const tot = ts.reduce((s, t) => s + (t.type === 'revenu' ? t.amount : -t.amount), 0);
    return `<div class="day-head"><span>${esc(dayLabel(d))}</span><span class="num">${signed(tot)}</span></div>
      <section class="card"><div class="list">${ts.map(txRow).join('')}</div></section>`;
  }).join('') : `<div class="card empty"><span class="e">🧾</span>Aucune opération ${f === 'all' ? '' : 'de ce type '}ce mois-ci.<br><br><button class="btn primary small" data-action="add">Ajouter une opération</button></div>`;

  return `
    <div class="tiles">
      <div class="card tile"><div class="k">🧾 Dépenses</div><div class="v num">${money(c.spent)}</div><div class="d">${m.tx.filter((t) => t.type === 'depense').length} opération(s)</div></div>
      <div class="card tile"><div class="k">🐷 Épargné</div><div class="v num">${money(c.saved)}</div><div class="d">${c.extraIn ? `+ ${money(c.extraIn)} de rentrées en plus` : 'ce mois-ci'}</div></div>
    </div>
    <div class="chips">${chip('all', 'Tout')}${chip('depense', 'Dépenses')}${chip('revenu', 'Rentrées')}${chip('epargne', 'Épargne')}</div>
    ${body}`;
}

function txRow(t) {
  let icon, title, sub, cls, sign;
  if (t.type === 'depense') {
    const k = catById(t.cat);
    icon = k ? k.icon : '📦'; title = t.note || (k ? k.name : 'Dépense'); sub = t.note ? (k ? k.name : 'Sans catégorie') : 'Dépense'; cls = 'amt-out'; sign = '−';
  } else if (t.type === 'revenu') {
    icon = '💶'; title = t.note || 'Rentrée'; sub = 'Rentrée en plus'; cls = 'amt-in'; sign = '+';
  } else {
    const g = goalById(t.goal);
    icon = g ? g.icon : '🐷'; title = t.note || (t.amount < 0 ? 'Retrait d’épargne' : 'Épargne');
    sub = g ? g.name : 'Épargne libre'; cls = 'amt-save'; sign = t.amount < 0 ? '+' : '→';
  }
  return `
    <button class="row" data-action="edit-tx" data-id="${esc(t.id)}">
      <span class="row-icon">${esc(icon)}</span>
      <span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></span>
      <span class="row-amt ${cls}">${sign}${money(Math.abs(t.amount))}</span>
    </button>`;
}

/* =========================================================
   Vue : Objectifs
   ========================================================= */
function viewGoals() {
  const target = Number(state.settings.savingsTarget) || 0;
  const total = state.goals.reduce((s, g) => s + goalSaved(g), 0);
  const c = calc(ui.month);
  const cards = state.goals.map((g) => {
    const s = goalSaved(g);
    const p = g.target > 0 ? Math.min(1, Math.max(0, s / g.target)) : 0;
    const left = Math.max(0, g.target - s);
    const share = state.goals.filter((x) => goalSaved(x) < x.target).length || 1;
    const perMonth = target / share;
    const eta = left <= 0 ? '🎉 Objectif atteint !' : perMonth > 0 ? `Encore ${money0(left)} · ~${Math.ceil(left / perMonth)} mois à ${money0(perMonth)}/mois` : `Encore ${money0(left)}`;
    const R = 26, C = 2 * Math.PI * R;
    return `
      <section class="card goal">
        <div class="goal-head">
          <div class="goal-ring">
            <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" stroke="var(--surface-2)" stroke-width="7"/>
              <circle cx="32" cy="32" r="${R}" stroke="${p >= 1 ? 'var(--good)' : 'var(--accent)'}" stroke-width="7" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}"/></svg>
            <span class="pct">${Math.round(p * 100)}%</span>
          </div>
          <div style="flex:1;min-width:0">
            <div class="goal-name">${esc(g.icon)} ${esc(g.name)}</div>
            <div class="num"><b>${money(s)}</b> <span class="faint">/ ${money0(g.target)}</span></div>
            <div class="goal-meta">${eta}</div>
          </div>
          <button class="icon-btn" data-action="edit-goal" data-id="${esc(g.id)}" aria-label="Modifier l’objectif">
            <svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        </div>
        <div class="btn-row">
          <button class="btn small" data-action="goal-move" data-id="${esc(g.id)}" data-dir="-1">− Retirer</button>
          <button class="btn small primary" data-action="goal-move" data-id="${esc(g.id)}" data-dir="1">+ Verser</button>
        </div>
      </section>`;
  }).join('');

  return `
    <div class="tiles">
      <div class="card tile"><div class="k">🐷 Total épargné</div><div class="v num">${money(total)}</div><div class="d">tous objectifs</div></div>
      <div class="card tile"><div class="k">🎯 Ce mois-ci</div><div class="v num">${money(c.saved)}</div><div class="d">sur ${money0(target)} prévus</div></div>
    </div>
    <section class="card">
      <h3 class="card-title">Épargne mensuelle prévue <small>réservée avant tes dépenses</small></h3>
      <div class="field-row" style="align-items:center">
        <input class="input num" inputmode="decimal" id="savingsTarget" value="${esc(amtInput(target))}" aria-label="Épargne mensuelle prévue en euros">
        <button class="btn" data-action="save-target" style="flex:none">OK</button>
      </div>
      <p class="help" style="margin:8px 0 0">Ce montant est retiré de ton « disponible à dépenser » tant que tu ne l’as pas versé sur un objectif.</p>
    </section>
    <h3 class="section-title">Mes objectifs</h3>
    ${cards || '<div class="card empty"><span class="e">🎯</span>Pas encore d’objectif.</div>'}
    <button class="btn block" data-action="edit-goal">＋ Nouvel objectif</button>`;
}

/* =========================================================
   Vue : Bilan
   ========================================================= */
function monthSeries(n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const mk = shiftMonth(ui.month, -i);
    const c = calc(mk);
    out.push({ mk, label: monthName(mk, { month: 'short' }).replace('.', ''), full: monthName(mk), in: round2(c.received + c.extraIn), out: round2(c.paid + c.spent), saved: round2(c.saved), hasData: c.hasData });
  }
  return out;
}

function viewStats() {
  const c = calc(ui.month);
  const series = monthSeries(6);
  const withData = series.filter((s) => s.hasData);
  const avgSpent = withData.length ? withData.reduce((s, x) => s + calc(x.mk).spent, 0) / withData.length : 0;

  const tMin = theory();
  const maxOv = {}; state.recurring.forEach((r) => { maxOv[r.id] = r.max; });
  const tMax = theory(maxOv);
  const unsureZero = {}; state.recurring.forEach((r) => { if (r.certainty === 'unsure') unsureZero[r.id] = 0; });
  const tSafe = theory(unsureZero);

  // Simulateur : un curseur par montant variable
  const sims = state.recurring.filter(isRange).map((r) => {
    const lo = r.certainty === 'unsure' ? 0 : r.min;
    return `
      <div class="field">
        <div class="lbl" style="display:flex;justify-content:space-between"><span>${esc(r.icon)} ${esc(r.name)}${r.certainty === 'unsure' ? ' <span class="badge unsure">~</span>' : ''}</span><b class="num" id="simv-${esc(r.id)}">${money(r.min)}</b></div>
        <input type="range" min="${lo}" max="${r.max}" step="1" value="${r.min}" data-sim="${esc(r.id)}" aria-label="${esc(r.name)}">
      </div>`;
  }).join('');

  // Répartition des dépenses du mois
  const catRows = Object.entries(c.byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = catRows.length ? catRows[0][1] : 0;
  const catHtml = catRows.length ? catRows.map(([id, v]) => {
    const k = catById(id) || { name: 'Supprimée', icon: '❔' };
    return `
      <div class="bar-item">
        <div class="bar-head"><span>${esc(k.icon)}</span><span class="name">${esc(k.name)}</span><span class="val">${money(v)} · ${Math.round((v / c.spent) * 100)} %</span></div>
        <div class="track"><i style="width:${(v / maxCat) * 100}%;background:${catColor(k)}"></i></div>
      </div>`;
  }).join('') : '<div class="empty small">Aucune dépense variable ce mois-ci.</div>';

  return `
    <section class="card">
      <h3 class="card-title">Reste mensuel <small>avant dépenses variables</small></h3>
      <div class="bars">
        ${scenarioRow('🛡️ Prudent', 'CAF au minimum, sans espèces', tSafe.net, tMax.net)}
        ${scenarioRow('🙂 Habituel', 'CAF au minimum + espèces au minimum', tMin.net, tMax.net)}
        ${scenarioRow('🚀 Optimiste', 'CAF au maximum + espèces au maximum', tMax.net, tMax.net)}
      </div>
      <p class="help" style="margin:12px 0 0">Charges fixes : <b class="num">${money(tMin.out)}</b>/mois · soit <b class="num">${money(tMin.out * 12)}</b>/an.</p>
    </section>

    <section class="card">
      <h3 class="card-title">Simulateur <small>et si…</small></h3>
      <div style="display:flex;flex-direction:column;gap:12px">${sims || '<div class="help">Aucun montant variable.</div>'}</div>
      <div class="tiles" style="margin-top:14px">
        <div class="tile" style="background:var(--surface-2);border-radius:14px"><div class="k">Par mois</div><div class="v num" id="simMonth">${money(tMin.net)}</div></div>
        <div class="tile" style="background:var(--surface-2);border-radius:14px"><div class="k">Sur un an</div><div class="v num" id="simYear">${money0(tMin.net * 12)}</div></div>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">Entrées et sorties <small>6 derniers mois</small></h3>
      ${barChart(series)}
      <div class="legend"><span><i style="background:var(--series-in)"></i>Entrées reçues</span><span><i style="background:var(--series-out)"></i>Sorties (charges + dépenses)</span></div>
      <details><summary>Voir le tableau</summary>
        <table class="data"><thead><tr><th>Mois</th><th>Entrées</th><th>Sorties</th><th>Épargne</th></tr></thead>
        <tbody>${series.map((s) => `<tr><td>${esc(s.full)}</td><td>${money(s.in)}</td><td>${money(s.out)}</td><td>${money(s.saved)}</td></tr>`).join('')}</tbody></table>
      </details>
      <p class="help" style="margin:10px 0 0">Dépenses variables moyennes : <b class="num">${money(avgSpent)}</b>/mois${withData.length ? ` (sur ${withData.length} mois renseigné${withData.length > 1 ? 's' : ''})` : ''}.</p>
    </section>

    <section class="card">
      <h3 class="card-title">Où part l’argent <small>${esc(monthName(ui.month))}</small></h3>
      <div class="bars">${catHtml}</div>
    </section>`;
}

function scenarioRow(title, sub, v, max) {
  const p = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  return `
    <div class="bar-item">
      <div class="bar-head"><span class="name">${title}</span><span class="val"><b class="num" style="color:var(--text)">${money(v)}</b></span></div>
      <div class="track"><i style="width:${p}%;background:var(--accent)"></i></div>
      <div class="help" style="margin-top:4px">${sub}</div>
    </div>`;
}

function barPath(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function barChart(series) {
  const W = 340, H = 190, L = 40, R = 6, T = 10, B = 24;
  const max = Math.max(100, ...series.flatMap((s) => [s.in, s.out]));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const colW = (W - L - R) / series.length;
  const bw = Math.min(18, (colW - 14) / 2);
  let grid = '';
  for (let v = 0; v <= top + 0.001; v += step) {
    grid += `<line class="${v === 0 ? 'base' : 'grid'}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
    grid += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v >= 1000 ? (v / 1000).toLocaleString('fr-FR') + ' k' : v}</text>`;
  }
  const cols = series.map((s, i) => {
    const cx = L + colW * i + colW / 2;
    const x1 = cx - bw - 1, x2 = cx + 1; // 2px d’écart entre les deux barres
    const isCur = s.mk === ui.month;
    return `
      <g class="col" tabindex="0" data-i="${i}" role="img" aria-label="${esc(s.full)} : entrées ${money(s.in)}, sorties ${money(s.out)}">
        <rect x="${L + colW * i}" y="${T}" width="${colW}" height="${H - T - B}" fill="transparent"/>
        <path class="mark" d="${barPath(x1, y(s.in), bw, y(0) - y(s.in), 4)}" fill="var(--series-in)"/>
        <path class="mark" d="${barPath(x2, y(s.out), bw, y(0) - y(s.out), 4)}" fill="var(--series-out)"/>
        <text x="${cx}" y="${H - 6}" text-anchor="middle" style="${isCur ? 'fill:var(--text);font-weight:700' : ''}">${esc(s.label)}</text>
      </g>`;
  }).join('');
  window.__series = series;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" id="chart">${grid}${cols}</svg>`;
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function bindChart() {
  const tip = $('#tooltip');
  const show = (g, ev) => {
    const s = window.__series[+g.dataset.i];
    tip.replaceChildren();
    const t = document.createElement('div'); t.className = 't'; t.textContent = s.full; tip.append(t);
    const row = (label, val, color) => {
      const r = document.createElement('div'); r.className = 'r';
      const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = color;
      sp.append(i, document.createTextNode(label));
      const b = document.createElement('b'); b.textContent = val;
      r.append(sp, b); tip.append(r);
    };
    row('Entrées', money(s.in), 'var(--series-in)');
    row('Sorties', money(s.out), 'var(--series-out)');
    row('Épargne', money(s.saved), 'var(--accent)');
    tip.hidden = false;
    const rect = g.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const x = ev && ev.clientX ? ev.clientX : rect.left + rect.width / 2;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, x - tw / 2)) + 'px';
    tip.style.top = Math.max(8, rect.top - tip.offsetHeight - 8) + 'px';
  };
  $$('#chart g.col').forEach((g) => {
    g.addEventListener('pointerenter', (e) => show(g, e));
    g.addEventListener('pointermove', (e) => show(g, e));
    g.addEventListener('pointerdown', (e) => show(g, e));
    g.addEventListener('focus', () => show(g));
    g.addEventListener('pointerleave', () => { tip.hidden = true; });
    g.addEventListener('blur', () => { tip.hidden = true; });
  });
  $$('[data-sim]').forEach((inp) => inp.addEventListener('input', updateSim));
}
function updateSim() {
  const ov = {};
  $$('[data-sim]').forEach((i) => { ov[i.dataset.sim] = Number(i.value); $('#simv-' + CSS.escape(i.dataset.sim)).textContent = money(Number(i.value)); });
  const t = theory(ov);
  $('#simMonth').textContent = money(t.net);
  $('#simYear').textContent = money0(t.net * 12);
}
window.addEventListener('scroll', () => { $('#tooltip').hidden = true; }, { passive: true });

/* =========================================================
   Vue : Réglages
   ========================================================= */
function viewSettings() {
  const th = state.settings.theme;
  const seg = (k, l) => `<button class="${th === k ? 'on' : ''}" data-action="theme" data-t="${k}">${l}</button>`;
  const recRows = (kind) => state.recurring.filter((r) => r.kind === kind).map((r) => `
    <button class="row" data-action="edit-rec" data-id="${esc(r.id)}">
      <span class="row-icon">${esc(r.icon)}</span>
      <span class="row-main"><span class="row-title">${esc(r.name)} ${r.certainty === 'unsure' ? '<span class="badge unsure">~</span>' : ''}</span>
        <span class="row-sub">${r.min === r.max ? money(r.min) : money0(r.min) + ' – ' + money0(r.max)}${r.note ? ' · ' + esc(r.note) : ''}</span></span>
      <span class="row-amt ${kind === 'gain' ? 'amt-in' : ''}">${kind === 'gain' ? '+' : '−'}</span>
    </button>`).join('');
  const catRows = state.categories.map((k) => `
    <button class="row" data-action="edit-cat" data-id="${esc(k.id)}">
      <span class="row-icon" style="box-shadow:inset 0 -3px 0 ${catColor(k)}">${esc(k.icon)}</span>
      <span class="row-main"><span class="row-title">${esc(k.name)}</span><span class="row-sub">${k.budget > 0 ? 'Budget ' + money0(k.budget) + '/mois' : 'Pas de budget'}</span></span>
    </button>`).join('');
  return `
    <h3 class="section-title">Apparence</h3>
    <div class="seg">${seg('auto', 'Auto')}${seg('light', 'Clair')}${seg('dark', 'Sombre')}</div>

    <h3 class="section-title">Rentrées récurrentes</h3>
    <section class="card"><div class="list">${recRows('gain')}</div>
      <button class="btn block small" style="margin-top:10px" data-action="edit-rec" data-kind="gain">＋ Ajouter une rentrée</button></section>

    <h3 class="section-title">Charges fixes</h3>
    <section class="card"><div class="list">${recRows('perte')}</div>
      <button class="btn block small" style="margin-top:10px" data-action="edit-rec" data-kind="perte">＋ Ajouter une charge</button></section>

    <h3 class="section-title">Catégories & budgets</h3>
    <section class="card"><div class="list">${catRows}</div>
      <button class="btn block small" style="margin-top:10px" data-action="edit-cat">＋ Ajouter une catégorie</button></section>

    <h3 class="section-title">Sauvegarde</h3>
    <section class="card" style="display:flex;flex-direction:column;gap:10px">
      <p class="help" style="margin:0">Tes données restent uniquement sur ce téléphone. Fais une sauvegarde de temps en temps (ou pour changer d’appareil).</p>
      <div class="btn-row">
        <button class="btn small" data-action="export">⬇️ Exporter</button>
        <button class="btn small" data-action="import">⬆️ Importer</button>
      </div>
      <button class="btn small danger" data-action="reset">Tout réinitialiser</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
    </section>
    <p class="help" style="text-align:center">Mon Budget · fonctionne hors-ligne · installable sur l’écran d’accueil</p>`;
}

/* =========================================================
   Feuilles (bottom sheets)
   ========================================================= */
function openSheet(html, onMount) {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-grip"></div>${html}`;
  sheet.hidden = false; $('#backdrop').hidden = false; $('#toast').hidden = true;
  document.body.style.overflow = 'hidden';
  onMount && onMount(sheet);
  const first = sheet.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 250);
}
function closeSheet() {
  $('#sheet').hidden = true; $('#backdrop').hidden = true;
  $('#sheet').innerHTML = '';
  document.body.style.overflow = '';
}
$('#backdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

/* ---------- Ajouter / modifier une opération ---------- */
function findTx(id) {
  for (const [mk, m] of Object.entries(state.months)) {
    const i = m.tx.findIndex((t) => t.id === id);
    if (i >= 0) return { mk, i, tx: m.tx[i] };
  }
  return null;
}

function txSheet(existing, preset = {}) {
  const t = existing ? { ...existing } : {
    type: preset.type || 'depense', amount: NaN, cat: state.categories[0]?.id, goal: preset.goal ?? state.goals[0]?.id ?? '',
    note: '', date: ui.month === currentMonth() ? todayISO() : `${ui.month}-01`,
  };
  let type = t.type;
  let withdraw = existing ? t.type === 'epargne' && t.amount < 0 : !!preset.withdraw;
  let cat = t.cat;

  const html = () => `
    <h2>${existing ? 'Modifier' : 'Nouvelle opération'}</h2>
    <form id="txForm" autocomplete="off">
      <div class="seg">
        <button type="button" class="${type === 'depense' ? 'on' : ''}" data-type="depense">Dépense</button>
        <button type="button" class="${type === 'revenu' ? 'on' : ''}" data-type="revenu">Rentrée</button>
        <button type="button" class="${type === 'epargne' ? 'on' : ''}" data-type="epargne">Épargne</button>
      </div>
      <div class="amount-input"><input id="txAmount" inputmode="decimal" placeholder="0" value="${esc(amtInput(Math.abs(t.amount)))}" aria-label="Montant" autofocus><span>€</span></div>
      <div class="quick">${[5, 10, 20, 50].map((v) => `<button type="button" data-quick="${v}">+${v} €</button>`).join('')}</div>
      ${type === 'depense' ? `
        <div class="field"><span class="lbl">Catégorie</span>
          <div class="cat-grid">${state.categories.map((k) => `<button type="button" class="cat-opt ${k.id === cat ? 'on' : ''}" data-cat="${esc(k.id)}"><span class="e">${esc(k.icon)}</span><span>${esc(k.name)}</span></button>`).join('')}</div>
        </div>` : ''}
      ${type === 'epargne' ? `
        <div class="seg">
          <button type="button" class="${!withdraw ? 'on' : ''}" data-wd="0">Mettre de côté</button>
          <button type="button" class="${withdraw ? 'on' : ''}" data-wd="1">Retirer</button>
        </div>
        <div class="field"><label for="txGoal">Objectif</label>
          <select class="input" id="txGoal"><option value="">Épargne libre</option>${state.goals.map((g) => `<option value="${esc(g.id)}" ${g.id === t.goal ? 'selected' : ''}>${esc(g.icon)} ${esc(g.name)}</option>`).join('')}</select>
        </div>` : ''}
      <div class="field-row">
        <div class="field"><label for="txDate">Date</label><input class="input" type="date" id="txDate" value="${esc(t.date)}" required></div>
      </div>
      <div class="field"><label for="txNote">Note</label><input class="input" id="txNote" value="${esc(t.note)}" placeholder="${type === 'depense' ? 'ex : Kebab avec Sam' : type === 'revenu' ? 'ex : Remboursement, prime…' : 'ex : Virement livret'}" maxlength="60"></div>
      <button class="btn primary block" type="submit">${existing ? 'Enregistrer' : 'Ajouter'}</button>
      ${existing ? '<button class="btn danger block" type="button" data-del>Supprimer</button>' : ''}
    </form>`;

  const mount = (sheet) => {
    const keep = () => {
      t.amount = parseAmt($('#txAmount', sheet).value);
      t.note = $('#txNote', sheet).value; t.date = $('#txDate', sheet).value || t.date;
      const g = $('#txGoal', sheet); if (g) t.goal = g.value;
    };
    const rerender = () => { keep(); sheet.innerHTML = `<div class="sheet-grip"></div>${html()}`; mount(sheet); };
    $$('[data-type]', sheet).forEach((b) => b.addEventListener('click', () => { type = b.dataset.type; rerender(); }));
    $$('[data-wd]', sheet).forEach((b) => b.addEventListener('click', () => { withdraw = b.dataset.wd === '1'; rerender(); }));
    $$('[data-cat]', sheet).forEach((b) => b.addEventListener('click', () => {
      cat = b.dataset.cat; $$('[data-cat]', sheet).forEach((x) => x.classList.toggle('on', x === b));
    }));
    $$('[data-quick]', sheet).forEach((b) => b.addEventListener('click', () => {
      const inp = $('#txAmount', sheet); const cur = parseAmt(inp.value);
      inp.value = amtInput((Number.isFinite(cur) ? cur : 0) + Number(b.dataset.quick));
    }));
    $('[data-del]', sheet)?.addEventListener('click', () => {
      closeSheet();
      commit('Opération supprimée', () => { const f = findTx(existing.id); if (f) state.months[f.mk].tx.splice(f.i, 1); });
    });
    $('#txForm', sheet).addEventListener('submit', (e) => {
      e.preventDefault(); keep();
      if (!(t.amount > 0)) { $('#txAmount', sheet).focus(); toast('Indique un montant'); return; }
      const rec = {
        id: existing ? existing.id : uid(), type, date: t.date, note: t.note.trim(),
        amount: type === 'epargne' && withdraw ? -t.amount : t.amount,
        created: existing?.created || new Date().toISOString(),
      };
      if (type === 'depense') rec.cat = cat;
      if (type === 'epargne' && t.goal) rec.goal = t.goal;
      closeSheet();
      commit(existing ? 'Opération modifiée' : `${type === 'depense' ? 'Dépense' : type === 'revenu' ? 'Rentrée' : 'Épargne'} ajoutée`, () => {
        if (existing) { const f = findTx(existing.id); if (f) state.months[f.mk].tx.splice(f.i, 1); }
        ensureMonth(monthOf(rec.date)).tx.push(rec);
      });
    });
  };
  openSheet(html(), mount);
}

/* ---------- Rentrée / charge du mois ---------- */
function lastAmount(id) {
  for (let i = 1; i <= 12; i++) { const e = getMonth(shiftMonth(ui.month, -i)).rec[id]; if (e?.done) return e.amount; }
  return null;
}
function recSheet(r) {
  const e = getMonth(ui.month).rec[r.id];
  const gain = r.kind === 'gain';
  const val = e?.done ? e.amount : lastAmount(r.id) ?? r.min;
  openSheet(`
    <h2>${esc(r.icon)} ${esc(r.name)}</h2>
    <form id="recForm" autocomplete="off">
      <p class="help" style="margin:-8px 0 0;text-align:center">${r.min === r.max ? 'Prévu ' + money(r.min) : `Entre ${money(r.min)} et ${money(r.max)}`}${r.certainty === 'unsure' ? ' · non assuré' : ''}${r.note ? ' · ' + esc(r.note) : ''}</p>
      <div class="amount-input"><input id="recAmount" inputmode="decimal" value="${esc(amtInput(val))}" aria-label="Montant" autofocus><span>€</span></div>
      ${r.min !== r.max ? `<div class="quick"><button type="button" data-v="${r.min}">Min ${money0(r.min)}</button><button type="button" data-v="${round2((r.min + r.max) / 2)}">Moyen ${money0((r.min + r.max) / 2)}</button><button type="button" data-v="${r.max}">Max ${money0(r.max)}</button></div>` : ''}
      ${r.certainty === 'unsure' ? '<p class="help" style="margin:0;text-align:center">Reçu en plusieurs fois ? Mets à jour le total quand tu veux.</p>' : ''}
      <button class="btn primary block" type="submit">${e?.done ? 'Mettre à jour' : gain ? 'Marquer comme reçu' : 'Marquer comme payé'}</button>
      ${e?.done ? `<button class="btn block" type="button" data-undo>${gain ? 'Pas encore reçu' : 'Pas encore payé'}</button>` : ''}
    </form>`, (sheet) => {
    $$('[data-v]', sheet).forEach((b) => b.addEventListener('click', () => { $('#recAmount', sheet).value = amtInput(Number(b.dataset.v)); }));
    $('[data-undo]', sheet)?.addEventListener('click', () => {
      closeSheet(); commit(`${r.name} : remis en attente`, () => { delete ensureMonth(ui.month).rec[r.id]; });
    });
    $('#recForm', sheet).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const a = parseAmt($('#recAmount', sheet).value);
      if (!(a >= 0)) { toast('Montant invalide'); return; }
      closeSheet();
      commit(`${r.name} : ${money(a)} ${gain ? 'reçu' : 'payé'}`, () => {
        ensureMonth(ui.month).rec[r.id] = { done: true, amount: a, date: e?.date || (ui.month === currentMonth() ? todayISO() : `${ui.month}-01`) };
      });
    });
  });
}
function toggleRec(id) {
  const r = recById(id); if (!r) return;
  const e = getMonth(ui.month).rec[id];
  if (e?.done || isRange(r)) return recSheet(r);
  commit(`${r.name} ${r.kind === 'gain' ? 'reçu' : 'payé'} ✓`, () => {
    ensureMonth(ui.month).rec[id] = { done: true, amount: r.min, date: ui.month === currentMonth() ? todayISO() : `${ui.month}-01` };
  });
}

/* ---------- Éditeurs (réglages) ---------- */
function recEditor(r, kind) {
  const isNew = !r;
  r = r ? { ...r } : { id: uid(), name: '', icon: kind === 'gain' ? '💶' : '🧾', kind, certainty: 'sure', min: NaN, max: NaN, note: '' };
  openSheet(`
    <h2>${isNew ? (kind === 'gain' ? 'Nouvelle rentrée' : 'Nouvelle charge') : 'Modifier'}</h2>
    <form id="recEd" autocomplete="off">
      <div class="field-row">
        <div class="field" style="flex:0 0 72px"><label for="reIcon">Icône</label><input class="input" id="reIcon" value="${esc(r.icon)}" maxlength="4" style="text-align:center;font-size:22px"></div>
        <div class="field"><label for="reName">Nom</label><input class="input" id="reName" value="${esc(r.name)}" required maxlength="30"></div>
      </div>
      <div class="field"><span class="lbl">Type</span>
        <div class="seg">
          <button type="button" data-k="gain" class="${r.kind === 'gain' ? 'on' : ''}">+ Gain</button>
          <button type="button" data-k="perte" class="${r.kind === 'perte' ? 'on' : ''}">− Perte</button>
        </div></div>
      <div class="field" id="certField" ${r.kind === 'gain' ? '' : 'hidden'}><span class="lbl">Fiabilité</span>
        <div class="seg">
          <button type="button" data-c="sure" class="${r.certainty === 'sure' ? 'on' : ''}">Assuré</button>
          <button type="button" data-c="unsure" class="${r.certainty === 'unsure' ? 'on' : ''}">~ Non assuré</button>
        </div></div>
      <div class="field-row">
        <div class="field"><label for="reMin">Montant min</label><input class="input num" id="reMin" inputmode="decimal" value="${esc(amtInput(r.min))}" required></div>
        <div class="field"><label for="reMax">Montant max</label><input class="input num" id="reMax" inputmode="decimal" value="${esc(amtInput(r.max))}" placeholder="= min"></div>
      </div>
      <div class="field"><label for="reNote">Note</label><input class="input" id="reNote" value="${esc(r.note)}" maxlength="60"></div>
      <button class="btn primary block" type="submit">Enregistrer</button>
      ${isNew ? '' : '<button class="btn danger block" type="button" data-del>Supprimer</button>'}
    </form>`, (sheet) => {
    $$('[data-k]', sheet).forEach((b) => b.addEventListener('click', () => {
      r.kind = b.dataset.k; $$('[data-k]', sheet).forEach((x) => x.classList.toggle('on', x === b));
      $('#certField', sheet).hidden = r.kind !== 'gain'; if (r.kind !== 'gain') r.certainty = 'sure';
    }));
    $$('[data-c]', sheet).forEach((b) => b.addEventListener('click', () => {
      r.certainty = b.dataset.c; $$('[data-c]', sheet).forEach((x) => x.classList.toggle('on', x === b));
    }));
    $('[data-del]', sheet)?.addEventListener('click', () => {
      closeSheet(); commit(`${r.name} supprimé`, () => { state.recurring = state.recurring.filter((x) => x.id !== r.id); });
    });
    $('#recEd', sheet).addEventListener('submit', (e) => {
      e.preventDefault();
      const min = parseAmt($('#reMin', sheet).value);
      let max = parseAmt($('#reMax', sheet).value);
      if (!(min >= 0)) { toast('Montant min invalide'); return; }
      if (!Number.isFinite(max) || max < min) max = min;
      const out = { ...r, name: $('#reName', sheet).value.trim() || 'Sans nom', icon: $('#reIcon', sheet).value.trim() || '•', min, max, note: $('#reNote', sheet).value.trim() };
      closeSheet();
      commit(isNew ? 'Ajouté' : 'Modifié', () => {
        const i = state.recurring.findIndex((x) => x.id === out.id);
        if (i >= 0) state.recurring[i] = out; else state.recurring.push(out);
      });
    });
  });
}

function catEditor(k) {
  const isNew = !k;
  const used = new Set(state.categories.map((c) => c.color));
  let free = 0; for (let i = 1; i <= PALETTE_SIZE; i++) if (!used.has(i)) { free = i; break; }
  k = k ? { ...k } : { id: uid(), name: '', icon: '🏷️', budget: 0, color: free };
  openSheet(`
    <h2>${isNew ? 'Nouvelle catégorie' : 'Modifier la catégorie'}</h2>
    <form id="catEd" autocomplete="off">
      <div class="field-row">
        <div class="field" style="flex:0 0 72px"><label for="ceIcon">Icône</label><input class="input" id="ceIcon" value="${esc(k.icon)}" maxlength="4" style="text-align:center;font-size:22px"></div>
        <div class="field"><label for="ceName">Nom</label><input class="input" id="ceName" value="${esc(k.name)}" required maxlength="24"></div>
      </div>
      <div class="field"><label for="ceBudget">Budget mensuel (0 = aucun)</label><input class="input num" id="ceBudget" inputmode="decimal" value="${esc(amtInput(k.budget))}"></div>
      <button class="btn primary block" type="submit">Enregistrer</button>
      ${isNew ? '' : '<button class="btn danger block" type="button" data-del>Supprimer</button>'}
    </form>`, (sheet) => {
    $('[data-del]', sheet)?.addEventListener('click', () => {
      closeSheet(); commit(`${k.name} supprimée`, () => { state.categories = state.categories.filter((x) => x.id !== k.id); });
    });
    $('#catEd', sheet).addEventListener('submit', (e) => {
      e.preventDefault();
      const b = parseAmt($('#ceBudget', sheet).value);
      const out = { ...k, name: $('#ceName', sheet).value.trim() || 'Sans nom', icon: $('#ceIcon', sheet).value.trim() || '🏷️', budget: b > 0 ? b : 0 };
      closeSheet();
      commit(isNew ? 'Catégorie ajoutée' : 'Catégorie modifiée', () => {
        const i = state.categories.findIndex((x) => x.id === out.id);
        if (i >= 0) state.categories[i] = out; else state.categories.push(out);
      });
    });
  });
}

function goalEditor(g) {
  const isNew = !g;
  g = g ? { ...g } : { id: uid(), name: '', icon: '🎯', target: NaN, initial: 0 };
  openSheet(`
    <h2>${isNew ? 'Nouvel objectif' : 'Modifier l’objectif'}</h2>
    <form id="goalEd" autocomplete="off">
      <div class="field-row">
        <div class="field" style="flex:0 0 72px"><label for="geIcon">Icône</label><input class="input" id="geIcon" value="${esc(g.icon)}" maxlength="4" style="text-align:center;font-size:22px"></div>
        <div class="field"><label for="geName">Nom</label><input class="input" id="geName" value="${esc(g.name)}" placeholder="ex : Vacances, Permis…" required maxlength="30"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="geTarget">Montant visé</label><input class="input num" id="geTarget" inputmode="decimal" value="${esc(amtInput(g.target))}" required></div>
        <div class="field"><label for="geInit">Déjà de côté</label><input class="input num" id="geInit" inputmode="decimal" value="${esc(amtInput(g.initial))}"></div>
      </div>
      <p class="help" style="margin:0">« Déjà de côté » = ce que tu avais avant d’utiliser l’appli. Les versements suivants s’ajoutent automatiquement.</p>
      <button class="btn primary block" type="submit">Enregistrer</button>
      ${isNew ? '' : '<button class="btn danger block" type="button" data-del>Supprimer l’objectif</button>'}
    </form>`, (sheet) => {
    $('[data-del]', sheet)?.addEventListener('click', () => {
      closeSheet(); commit(`${g.name} supprimé`, () => {
        state.goals = state.goals.filter((x) => x.id !== g.id);
        for (const m of Object.values(state.months)) for (const t of m.tx) if (t.goal === g.id) delete t.goal;
      });
    });
    $('#goalEd', sheet).addEventListener('submit', (e) => {
      e.preventDefault();
      const target = parseAmt($('#geTarget', sheet).value);
      if (!(target > 0)) { toast('Indique un montant visé'); return; }
      const init = parseAmt($('#geInit', sheet).value);
      const out = { ...g, name: $('#geName', sheet).value.trim() || 'Objectif', icon: $('#geIcon', sheet).value.trim() || '🎯', target, initial: init > 0 ? init : 0 };
      closeSheet();
      commit(isNew ? 'Objectif créé' : 'Objectif modifié', () => {
        const i = state.goals.findIndex((x) => x.id === out.id);
        if (i >= 0) state.goals[i] = out; else state.goals.push(out);
      });
    });
  });
}

/* ---------- Sauvegarde ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mon-budget-${todayISO()}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Sauvegarde téléchargée');
}
function importData() {
  const inp = $('#importFile');
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const next = normalize(JSON.parse(await f.text()));
      if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
      commit('Sauvegarde importée', () => { state = next; });
    } catch (e) { toast('Fichier invalide'); }
    inp.value = '';
  };
  inp.click();
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.replaceChildren(document.createTextNode(msg));
  if (undo) {
    const b = document.createElement('button'); b.textContent = 'Annuler';
    b.addEventListener('click', () => { el.hidden = true; undo(); });
    el.append(b);
  }
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, undo ? 4500 : 2500);
}

/* =========================================================
   Actions (délégation d’événements)
   ========================================================= */
const actions = {
  go: (b) => { const v = b.dataset.view; if (location.hash.slice(1) === v) { render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } else location.hash = v; },
  'month-prev': () => { ui.month = shiftMonth(ui.month, -1); render(); },
  'month-next': () => { ui.month = shiftMonth(ui.month, 1); render(); },
  'month-today': () => { ui.month = currentMonth(); render(); },
  add: () => txSheet(null),
  rec: (b) => toggleRec(b.dataset.id),
  'edit-tx': (b) => { const f = findTx(b.dataset.id); if (f) txSheet(f.tx); },
  'ops-filter': (b) => { ui.opsFilter = b.dataset.f; render(); },
  'goal-move': (b) => txSheet(null, { type: 'epargne', goal: b.dataset.id, withdraw: b.dataset.dir === '-1' }),
  'edit-goal': (b) => goalEditor(b.dataset.id ? goalById(b.dataset.id) : null),
  'save-target': () => {
    const v = parseAmt($('#savingsTarget').value);
    if (!(v >= 0)) { toast('Montant invalide'); return; }
    commit('Épargne prévue : ' + money(v) + '/mois', () => { state.settings.savingsTarget = v; });
  },
  theme: (b) => commit(null, () => { state.settings.theme = b.dataset.t; }),
  'edit-rec': (b) => recEditor(b.dataset.id ? recById(b.dataset.id) : null, b.dataset.kind),
  'edit-cat': (b) => catEditor(b.dataset.id ? catById(b.dataset.id) : null),
  export: exportData,
  import: importData,
  reset: () => {
    if (!confirm('Effacer toutes les données et revenir aux valeurs de départ ?')) return;
    commit('Données réinitialisées', () => { state = defaultState(); });
  },
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || $('#sheet').contains(b)) return;
  const fn = actions[b.dataset.action];
  if (fn) { e.preventDefault(); fn(b); }
});
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });

// Si on revient sur l’appli un autre mois, on se recale sur le mois courant
let lastSeenMonth = currentMonth();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentMonth() !== lastSeenMonth) {
    lastSeenMonth = currentMonth(); ui.month = lastSeenMonth; render();
  }
});

render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
