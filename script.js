// ===== STATE =====
const AHK_PLAYERS = [
  'Aleksander Rachkovski',
  'Audronė Gurinskienė',
  'Clara Bommersbach',
  'David Hoffmann',
  'Dominic Otto',
  'Duaa Fourah',
  'Edgars Ločmelis',
  'Egita Proveja',
  'Elo Saari',
  'Eugenijus Vaitekūnas',
  'Eve Vendelin',
  'Felix Doerfel',
  'Florian Schröder',
  'Ieva Mālmane',
  'Ilse Garda',
  'Inese Reipa',
  'Inga Laurušonė',
  'Janina Rapp',
  'Jonathan Dormann',
  'Julian Seldenreich',
  'Juratė Vilimienė',
  'Justina Bražionienė',
  'Karen Voolaid',
  'Kristiina Soe',
  'Külli Duubas',
  'Leokadija Sungailienė',
  'Līva Melbārzde',
  'Maija Pāvila',
  'Marina Konovalika',
  'Māris Balčūns',
  'Merili Turja',
  'Mika Richter',
  'Moritz Topp',
  'Neringa Sedelskė',
  'Patricia Mielke',
  'Povilas Gembickis',
  'Reet Truuts',
  'Rūta Kildunavičienė',
  'Solveiga Āboliņa',
  'Sonja Ruetz',
  'Tarmo Mutso',
  'Ursula Kütt',
  'Vineta Šķērīte',
];

// ===== OFFICE MAP =====
const OFFICE_MAP = {
  "Aleksander Rachkovski": "LV",
  "Audronė Gurinskienė": "LT",
  "Clara Bommersbach": "LT",
  "David Hoffmann": "EE",
  "Dominic Otto": "LT",
  "Duaa Fourah": "EE",
  "Edgars Ločmelis": "LV",
  "Egita Proveja": "LV",
  "Elo Saari": "EE",
  "Eugenijus Vaitekūnas": "LT",
  "Eve Vendelin": "EE",
  "Felix Doerfel": "LT",
  "Florian Schröder": "LV",
  "Ieva Mālmane": "LV",
  "Ilse Garda": "LV",
  "Inese Reipa": "LV",
  "Inga Laurušonė": "LT",
  "Janina Rapp": "LT",
  "Jonathan Dormann": "EE",
  "Julian Seldenreich": "EE",
  "Juratė Vilimienė": "LT",
  "Justina Bražionienė": "LT",
  "Karen Voolaid": "EE",
  "Kristiina Soe": "EE",
  "Külli Duubas": "EE",
  "Leokadija Sungailienė": "LT",
  "Līva Melbārzde": "LV",
  "Maija Pāvila": "LV",
  "Marina Konovalika": "LV",
  "Māris Balčūns": "LV",
  "Merili Turja": "EE",
  "Mika Richter": "LV",
  "Moritz Topp": "LT",
  "Neringa Sedelskė": "LT",
  "Patricia Mielke": "LV",
  "Povilas Gembickis": "LT",
  "Reet Truuts": "EE",
  "Rūta Kildunavičienė": "LT",
  "Solveiga Āboliņa": "LV",
  "Sonja Ruetz": "LT",
  "Tarmo Mutso": "EE",
  "Ursula Kütt": "EE",
  "Vineta Šķērīte": "LV"
};
const OFFICE_COLORS = {
  EE: { bg: '#003366', text: '#fff', label: '🇪🇪 Estland' },
  LV: { bg: '#c0392b', text: '#fff', label: '🇱🇻 Lettland' },
  LT: { bg: '#16a34a', text: '#fff', label: '🇱🇹 Litauen' },
};
function getOffice(player) { return OFFICE_MAP[player] || null; }
function getOfficeColor(player) { const o = getOffice(player); return o ? OFFICE_COLORS[o] : null; }

let state = {
  players: [...AHK_PLAYERS],
  weeks: [],
  tips: {},
  results: {}
};

// ===== SUPABASE =====
const SUPABASE_URL = 'https://pajzutzwwkskaxbpcjjz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhanp1dHp3d2tza2F4YnBjamp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTMzMjMsImV4cCI6MjA5NTM4OTMyM30.LzyPhoJkwA4y3DLxQZ00aOUq1LOJQFONgQHF3rZ3SFg';

const sbHeaders = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Prefer': 'resolution=merge-duplicates'
};

async function sbGet(table, filter) {
  filter = filter || '';
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + filter, {
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  });
  return res.json();
}

async function sbUpsert(table, data) {

  let conflict = '';

  if (table === 'tippspiel') {
    conflict = '?on_conflict=player,week_id';
  }

  if (table === 'tippspiel_config') {
    conflict = '?on_conflict=key';
  }

  const res = await fetch(
    SUPABASE_URL + '/rest/v1/' + table + conflict,
    {
      method: 'POST',
      headers: {
        ...sbHeaders,
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(data)
    }
  );

  if (!res.ok) {
    console.error(
      'Supabase Error:',
      res.status,
      await res.text()
    );
  }
}

// ===== AUTO-REFRESH =====
let _lastResultsHash = '';
async function pollForUpdates() {
  try {
    const cfg = await sbGet('tippspiel_config', 'key=eq.state&select=value');
    if (cfg && cfg[0] && cfg[0].value) {
      const hash = JSON.stringify(cfg[0].value);
      if (_lastResultsHash && hash !== _lastResultsHash) {
        const saved = cfg[0].value;
        if (saved.weeks) state.weeks = saved.weeks;
        if (saved.results) state.results = saved.results;
        populateWeekSelects();
        const activeView = document.querySelector('.view.active')?.id;
        if (activeView === 'view-rangliste') renderRankingTab();
        if (activeView === 'view-tipps') renderTipTab();
      }
      _lastResultsHash = hash;
    }
  } catch(e) {}
}
setInterval(pollForUpdates, 30000);

async function loadState() {
  state.players = [...AHK_PLAYERS];
  state.weeks = [];
  state.tips = {};
  state.results = {};

  try {
    const cfg = await sbGet('tippspiel_config', 'key=eq.state&select=value');
    if (cfg && cfg[0] && cfg[0].value) {
      const saved = cfg[0].value;
      if (saved.weeks) state.weeks = saved.weeks;
      if (saved.results) state.results = saved.results;
      _lastResultsHash = JSON.stringify(cfg[0].value);
    }
  } catch(e) { console.warn('Config load failed', e); }

  try {
    const rows = await sbGet('tippspiel', 'select=player,week_id,tips');
    (rows || []).forEach(function(r) {
      if (!state.tips[r.week_id]) state.tips[r.week_id] = {};
      state.tips[r.week_id][r.player] = r.tips;
    });
  } catch(e) { console.warn('Tips load failed', e); }
}

async function saveState() {
  try {
    await sbUpsert('tippspiel_config', {
      key: 'state',
      value: { weeks: state.weeks, results: state.results }
    });
  } catch(e) { console.warn('Config save failed', e); }
}

async function saveTipToDb(weekId, player, tips) {
  try {
    await sbUpsert('tippspiel', { player: player, week_id: weekId, tips: tips });
  } catch(e) { console.warn('Tips save failed', e); }
}

// ===== TABS =====
const ADMIN_PASSWORD = 'TP!';
let adminUnlocked = false;

function showTab(name) {
  if ((name === 'ergebnisse' || name === 'einstellungen') && !adminUnlocked) {
    const pw = prompt('Admin-Passwort eingeben:');
    if (pw !== ADMIN_PASSWORD) { alert('Falsches Passwort.'); return; }
    adminUnlocked = true;
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  const tabs = { tipps: 0, ergebnisse: 1, rangliste: 2, einstellungen: 3 };
  document.querySelectorAll('.tab')[tabs[name]].classList.add('active');
  if (name === 'einstellungen') renderSettings();
  if (name === 'tipps') renderTipTab();
  if (name === 'ergebnisse') renderResultTab();
  if (name === 'rangliste') renderRankingTab();
}

// ===== TOAST =====
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== SETTINGS =====
function renderSettings() {
  const grid = document.getElementById('player-grid');
  if (!grid) return;
  const players = state.players.filter(p => p.trim() !== '');
  if (players.length === 0) {
    grid.innerHTML = '<p style="font-size:14px;color:var(--text-muted);">Keine Teilnehmer.</p>';
  } else {
    grid.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">` +
      players.map(p => {
        const oc = getOfficeColor(p);
        const dot = oc ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${oc.bg};margin-right:4px;flex-shrink:0;"></span>` : '';
        return `<div style="display:flex;align-items:center;gap:4px;background:var(--dark-2);border:1px solid var(--dark-4);border-radius:8px;padding:6px 12px;">
          ${dot}<span style="font-size:14px;font-weight:500;">${p}</span>
          <button onclick="removePlayer('${p}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;line-height:1;padding:0 2px;margin-left:4px;">×</button>
        </div>`;
      }).join('') + `</div>`;
  }
  renderWeekManager();
}

async function removePlayer(name) {
  if (!confirm(`"${name}" wirklich entfernen?`)) return;
  state.players = state.players.filter(p => p !== name);
  await saveState();
  renderSettings();
}

function onTipperSelectChange() {
  loadTipperForm();
}

async function resetAll() {
  if (!confirm('Wirklich ALLES zurücksetzen? Alle Tipps und Ergebnisse gehen verloren!')) return;
  state = { players: [...AHK_PLAYERS], weeks: [], tips: {}, results: {} };
  await saveState();
  renderSettings();
  toast('Zurückgesetzt');
}

// ===== WEEK MANAGER =====
function renderWeekManager() {
  const mgr = document.getElementById('week-manager');
  if (!mgr) return;
  if (state.weeks.length === 0) {
    mgr.innerHTML = '<p class="info-text">Noch keine Spielwochen angelegt.</p>';
    return;
  }
  mgr.innerHTML = state.weeks.map((w, wi) => {
    const locked = isWeekLocked(w);
    const deadlineInfo = w.startDate
      ? (() => { const d = new Date(w.startDate); d.setDate(d.getDate()-1); d.setHours(23,59,59,0); return d.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); })()
      : (w.deadline ? new Date(w.deadline).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '–');
    return `
    <div style="background:var(--dark-2);border:1px solid var(--dark-4);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <input style="background:transparent;border:none;border-bottom:1px solid #d0d5de;color:#003366;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;padding:2px 4px;width:300px;"
          value="${w.name}" onchange="state.weeks[${wi}].name=this.value;saveState();" placeholder="Woche 1 – Gruppenphase">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px;">Erste Spiele am:</label>
            <input type="date" style="background:#fff;border:1px solid var(--dark-4);border-radius:6px;padding:4px 8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;"
              value="${w.startDate||''}" onchange="state.weeks[${wi}].startDate=this.value;delete state.weeks[${wi}].deadline;saveState();renderWeekManager();">
          </div>
          <div style="font-size:11px;color:var(--text-muted);">
            Deadline:<br><strong style="color:var(--text);">${deadlineInfo}</strong><br>
            <span style="color:${locked?'var(--red)':'var(--green)'}">${locked?'🔒 Gesperrt':'🟢 Offen'}</span>
          </div>
          <button class="btn btn-outline" style="padding:6px 12px;font-size:12px;" onclick="removeWeek(${wi})">× Löschen</button>
        </div>
      </div>
      <div id="games-${wi}"></div>
      <button class="btn btn-outline" style="padding:6px 14px;font-size:12px;margin-top:8px;" onclick="addGame(${wi})">+ Spiel hinzufügen</button>
    </div>`;
  }).join('');
  state.weeks.forEach((w, wi) => renderGamesInWeek(wi));
}

function renderGamesInWeek(wi) {
  const area = document.getElementById('games-'+wi);
  if (!area) return;
  const w = state.weeks[wi];
  if (!w.games || w.games.length === 0) {
    area.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">Noch keine Spiele.</p>';
    return;
  }
  area.innerHTML = w.games.map((g, gi) => `
    <div style="display:grid;grid-template-columns:1fr auto 1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--dark-3);">
      <input style="background:var(--dark-3);border:1px solid var(--dark-4);border-radius:6px;padding:6px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;"
        placeholder="Heimteam" value="${g.home||''}" oninput="state.weeks[${wi}].games[${gi}].home=this.value;">
      <span style="color:var(--text-muted);font-size:12px;">vs</span>
      <input style="background:var(--dark-3);border:1px solid var(--dark-4);border-radius:6px;padding:6px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;"
        placeholder="Auswärtsteam" value="${g.away||''}" oninput="state.weeks[${wi}].games[${gi}].away=this.value;">
      <input style="background:var(--dark-3);border:1px solid var(--dark-4);border-radius:6px;padding:6px 8px;color:var(--text-muted);font-family:'DM Sans',sans-serif;font-size:11px;width:80px;"
        placeholder="Gruppe A" value="${g.group||''}" oninput="state.weeks[${wi}].games[${gi}].group=this.value;">
      <button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px 8px;" onclick="removeGame(${wi},${gi})">×</button>
    </div>
  `).join('') + `
  <div style="margin-top:10px;">
    <button class="btn btn-gold" style="padding:7px 18px;font-size:13px;" onclick="savePaarungen(${wi})">💾 Paarungen speichern</button>
    <span id="save-hint-${wi}" style="font-size:12px;color:var(--text-muted);margin-left:10px;"></span>
  </div>`;
}

async function addWeek() {
  const id = 'w' + Date.now();
  state.weeks.push({ id, name: `Woche ${state.weeks.length+1}`, deadline: '', games: [] });
  await saveState();
  renderWeekManager();
}

async function removeWeek(wi) {
  if (!confirm('Woche und alle zugehörigen Tipps löschen?')) return;
  const id = state.weeks[wi].id;
  state.weeks.splice(wi, 1);
  delete state.tips[id];
  delete state.results[id];
  await saveState();
  renderWeekManager();
}

async function addGame(wi) {
  if (!state.weeks[wi].games) state.weeks[wi].games = [];
  state.weeks[wi].games.push({ home: '', away: '', group: '' });
  await saveState();
  renderGamesInWeek(wi);
}

async function removeGame(wi, gi) {
  state.weeks[wi].games.splice(gi, 1);
  await saveState();
  renderGamesInWeek(wi);
}

async function savePaarungen(wi) {
  const hint = document.getElementById('save-hint-' + wi);
  if (hint) hint.textContent = 'Wird gespeichert…';
  await saveState();
  if (hint) hint.textContent = '✓ Gespeichert!';
  setTimeout(() => { if (hint) hint.textContent = ''; }, 3000);
  toast('Paarungen gespeichert ✓');
}

// ===== WEEK SELECTS =====
function populateWeekSelects() {
  ['week-select-tip','week-select-result','week-select-overview'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = state.weeks.length === 0 ? '<option value="">Keine Wochen</option>'
      : state.weeks.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    if (cur && state.weeks.find(w=>w.id===cur)) el.value = cur;
  });
  const rrank = document.getElementById('week-select-rank');
  if (rrank) {
    const cur = rrank.value;
    rrank.innerHTML = '<option value="all">Gesamt</option>' +
      state.weeks.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
    if (cur) rrank.value = cur;
  }
}

// ===== TIPS TAB =====
function renderTipTab() {
  populateWeekSelects();
  populatePlayerSelect();
  loadTipperForm();
}

// Native <select> — einfach und zuverlässig
function populatePlayerSelect() {
  const sel = document.getElementById('tipper-select');
  if (!sel) return;
  const cur = sel.value;
  const players = state.players.filter(p => p.trim() !== '');
  sel.innerHTML = '<option value="">— Name wählen —</option>' +
    players.map(p => `<option value="${p}">${p}</option>`).join('');
  if (cur && players.includes(cur)) sel.value = cur;
}

function loadTipperForm() {
  const player = document.getElementById('tipper-select')?.value;
  const weekId = document.getElementById('week-select-tip')?.value;
  const area = document.getElementById('tipper-form-area');
  if (!area) return;

  if (!player || !weekId) {
    area.innerHTML = '<div class="empty-hint">Bitte Namen und Spielwoche wählen.</div>';
    return;
  }

  const week = state.weeks.find(w=>w.id===weekId);
  if (!week) { area.innerHTML = '<div class="empty-hint">Woche nicht gefunden.</div>'; return; }

  const isLocked = isWeekLocked(week);
  const existing = (state.tips[weekId] && state.tips[weekId][player]) || [];
  const games = week.games || [];
  if (games.length === 0) {
    area.innerHTML = '<div class="empty-hint">Noch keine Spiele in dieser Woche eingetragen.</div>';
    return;
  }

  let html = '';
  if (isLocked) {
    html += `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 16px;font-size:13px;color:var(--red);margin-bottom:16px;">
      🔒 Deadline abgelaufen – Tipps gesperrt</div>`;
  }

  html += '<div class="games-list">';
  games.forEach((g, gi) => {
    const t = existing[gi] || {home:'',away:''};
    const locked = isLocked ? 'disabled' : '';
    html += `
      <div class="game-card ${isLocked?'locked':''}">
        <div class="game-meta">
          <span class="game-group-badge">${g.group||'Gruppe ?'}</span>${g.datetime ? `<span class="game-date">${g.datetime} (EEST)</span>` : ''}
        </div>
        <div class="game-team home">${g.home||'Team A'}</div>
        <div class="game-vs">
          <input class="score-input" type="number" min="0" max="20" id="tip-${gi}-h" value="${t.home}" placeholder="–" ${locked}>
          <span class="score-colon">:</span>
          <input class="score-input" type="number" min="0" max="20" id="tip-${gi}-a" value="${t.away}" placeholder="–" ${locked}>
        </div>
        <div class="game-team away">${g.away||'Team B'}</div>
      </div>`;
  });
  html += '</div>';

  if (!isLocked) {
    html += `<div class="btn-row"><button class="btn btn-gold" onclick="saveTips('${weekId}','${player}',${games.length})">Tipps speichern</button></div>`;
  }
  area.innerHTML = html;
}

async function saveTips(weekId, player, gameCount) {
  if (!state.tips[weekId]) state.tips[weekId] = {};
  const tips = [];
  for (let i = 0; i < gameCount; i++) {
    const h = document.getElementById(`tip-${i}-h`)?.value;
    const a = document.getElementById(`tip-${i}-a`)?.value;
    tips.push({ home: h === '' ? '' : parseInt(h), away: a === '' ? '' : parseInt(a) });
  }
  state.tips[weekId][player] = tips;
  toast('Tipps werden gespeichert…');
  await saveTipToDb(weekId, player, tips);
  toast(`Tipps von ${player} gespeichert ✓`);
}

function isWeekLocked(week) {
  if (week.deadline) return new Date() > new Date(week.deadline);
  if (week.startDate) {
    const d = new Date(week.startDate);
    d.setDate(d.getDate() - 1);
    d.setHours(23, 59, 59, 0);
    return new Date() > d;
  }
  return false;
}

// ===== RESULT TAB =====
function renderResultTab() {
  populateWeekSelects();
  loadResultForm();
}

function loadResultForm() {
  const weekId = document.getElementById('week-select-result')?.value;
  const area = document.getElementById('result-form-area');
  if (!area) return;
  if (!weekId) { area.innerHTML = '<div class="empty-hint">Woche wählen.</div>'; return; }

  const week = state.weeks.find(w=>w.id===weekId);
  if (!week) return;
  const games = week.games || [];
  if (games.length === 0) { area.innerHTML = '<div class="empty-hint">Keine Spiele in dieser Woche.</div>'; return; }

  const existing = state.results[weekId] || [];
  let html = '<div class="games-list">';
  games.forEach((g, gi) => {
    const r = existing[gi] || {home:'',away:''};
    html += `
      <div class="game-card">
        <div class="game-meta">
          <span class="game-group-badge">${g.group||'?'}</span>${g.datetime ? `<span class="game-date">${g.datetime} (EEST)</span>` : ''}
        </div>
        <div class="game-team home">${g.home||'Team A'}</div>
        <div class="game-vs">
          <input class="score-input" type="number" min="0" max="20" id="res-${gi}-h" value="${r.home}" placeholder="–">
          <span class="score-colon">:</span>
          <input class="score-input" type="number" min="0" max="20" id="res-${gi}-a" value="${r.away}" placeholder="–">
        </div>
        <div class="game-team away">${g.away||'Team B'}</div>
      </div>`;
  });
  html += '</div>';
  html += `<div class="btn-row"><button class="btn btn-gold" onclick="saveResults('${weekId}',${games.length})">Ergebnisse speichern & Punkte berechnen</button></div>`;
  area.innerHTML = html;
}

async function saveResults(weekId, gameCount) {
  const results = [];
  for (let i = 0; i < gameCount; i++) {
    const h = document.getElementById(`res-${i}-h`)?.value;
    const a = document.getElementById(`res-${i}-a`)?.value;
    results.push({ home: h===''?null:parseInt(h), away: a===''?null:parseInt(a) });
  }
  state.results[weekId] = results;
  toast('Ergebnisse werden gespeichert…');
  await saveState();
  toast('Ergebnisse gespeichert und Punkte berechnet ✓');
}

// ===== POINTS CALC =====
function calcPoints(tip, result) {
  if (tip.home==='' || tip.away==='' || tip.home==null || tip.away==null) return null;
  if (result.home==null || result.away==null) return null;
  const th = parseInt(tip.home), ta = parseInt(tip.away);
  const rh = parseInt(result.home), ra = parseInt(result.away);
  if (th === rh && ta === ra) return { pts: 5, label: 'exact' };
  const tipOut = th > ta ? 'H' : th < ta ? 'A' : 'D';
  const resOut = rh > ra ? 'H' : rh < ra ? 'A' : 'D';
  if (tipOut === resOut) {
    let pts = (th === rh || ta === ra) ? 4 : 3;
    return { pts, label: 'partial' };
  }
  return { pts: 0, label: 'wrong' };
}

function getPlayerTotalPoints(player, weekId) {
  let total = 0, exact = 0;
  const weeks = weekId === 'all' ? state.weeks : state.weeks.filter(w=>w.id===weekId);
  weeks.forEach(week => {
    const tips = (state.tips[week.id] && state.tips[week.id][player]) || [];
    const results = state.results[week.id] || [];
    tips.forEach((t, i) => {
      const r = results[i];
      if (r) { const p = calcPoints(t, r); if (p) { total += p.pts; if (p.label==='exact') exact++; } }
    });
  });
  return { total, exact };
}

// ===== RANKING TAB =====
function renderRankingTab() {
  populateWeekSelects();
  renderRanking();
  renderTipsOverview();
}

function renderRanking() {
  const weekId = document.getElementById('week-select-rank')?.value || 'all';
  const area = document.getElementById('ranking-area');
  if (!area) return;

  const players = state.players.filter(p=>p.trim()!=='');
  if (players.length === 0) { area.innerHTML = '<div class="empty-hint">Noch keine Spieler eingetragen.</div>'; return; }

  const ranked = players.map(p => {
    const { total, exact } = getPlayerTotalPoints(p, weekId);
    return { name: p, total, exact };
  }).sort((a,b) => b.total - a.total || b.exact - a.exact);

  let html = '<table class="ranking-table"><thead><tr><th>Platz</th><th>Name</th><th style="text-align:right">Punkte</th><th style="text-align:right">Exakt</th></tr></thead><tbody>';
  ranked.forEach((r,i) => {
    const oc = getOfficeColor(r.name);
    const badge = oc ? `<span style="display:inline-block;font-size:10px;padding:1px 7px;border-radius:10px;background:${oc.bg};color:${oc.text};font-weight:600;margin-left:7px;vertical-align:middle;">${oc.label}</span>` : '';
    html += `<tr class="rank-${i+1}">
      <td class="rank-num">${i+1}</td>
      <td class="rank-name">${r.name}${badge}</td>
      <td class="rank-pts">${r.total}</td>
      <td class="rank-exact">🎯 ${r.exact}</td>
    </tr>`;
  });
  html += '</tbody></table>';

  html += `<div style="background:var(--dark-2);border:1px solid var(--dark-4);border-radius:8px;padding:12px 16px;font-size:13px;color:var(--text-muted);margin-bottom:20px;">
    <strong style="color:var(--text)">Punktesystem:</strong> &nbsp;
    Exaktes Ergebnis = <strong style="color:#003366">5 Punkte</strong> &nbsp;|&nbsp;
    Richtiger Ausgang + ein korrektes Tor = <strong style="color:#003366">4 Punkte</strong> &nbsp;|&nbsp;
    Richtiger Ausgang = <strong style="color:#003366">3 Punkte</strong>
  </div>`;

  // Büro-Wertung
  const officePoints = { EE: 0, LV: 0, LT: 0 };
  const officeCounts = { EE: 0, LV: 0, LT: 0 };
  ranked.forEach(r => {
    const o = getOffice(r.name);
    if (!o) return;
    officePoints[o] += r.total;
    officeCounts[o]++;
  });
  const officeRanked = ['EE','LV','LT'].map(o => ({
    o, pts: officePoints[o], count: officeCounts[o],
    avg: officeCounts[o] > 0 ? (officePoints[o] / officeCounts[o]).toFixed(1) : 0
  })).sort((a,b) => b.pts - a.pts);

  html += `<div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;color:#003366;margin-bottom:12px;">🏢 Büro-Wertung</div>`;
  html += `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">`;
  officeRanked.forEach((o, i) => {
    const oc = OFFICE_COLORS[o.o];
    html += `<div style="flex:1;min-width:160px;background:${oc.bg};color:${oc.text};border-radius:10px;padding:16px 20px;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;">${i+1}. ${oc.label}</div>
      <div style="font-size:32px;font-family:'Bebas Neue',sans-serif;">${o.pts} Pkt.</div>
      <div style="font-size:12px;opacity:0.85;">Ø ${o.avg} pro Person · ${o.count} Teilnehmer</div>
    </div>`;
  });
  html += `</div>`;
  area.innerHTML = html;
}

function renderTipsOverview() {
  const weekId = document.getElementById('week-select-overview')?.value;
  const area = document.getElementById('tips-overview-area');
  if (!area) return;
  if (!weekId) { area.innerHTML = '<div class="empty-hint">Spielwoche wählen.</div>'; return; }

  const week = state.weeks.find(w=>w.id===weekId);
  if (!week) return;

  const games = week.games || [];
  const players = state.players.filter(p=>p.trim()!=='');
  const results = state.results[weekId] || [];
  if (players.length === 0) { area.innerHTML = '<div class="empty-hint">Keine Spieler.</div>'; return; }

  let html = '<div class="tips-player-grid">';
  players.forEach(player => {
    const tips = (state.tips[weekId] && state.tips[weekId][player]) || [];
    let weekPts = 0;
    let tipsHtml = '';

    games.forEach((g, gi) => {
      const t = tips[gi];
      const r = results[gi];
      let scoreLabel = '– : –';
      let cls = 'pending';
      if (t && (t.home !== '' && t.away !== '')) {
        scoreLabel = `${t.home} : ${t.away}`;
        if (r && r.home != null) {
          const p = calcPoints(t, r);
          if (p) { weekPts += p.pts; cls = p.label; }
        }
      }
      tipsHtml += `<div class="tip-row">
        <span class="tip-match">${g.home||'?'} – ${g.away||'?'}</span>
        <span class="tip-score ${cls}">${scoreLabel}</span>
      </div>`;
    });

    const oc = getOfficeColor(player);
    const headerBg = oc ? oc.bg : '#003366';
    html += `<div class="tip-card">
      <div class="tip-card-header" style="background:${headerBg};">
        <span>${player}</span>
        <span class="tip-card-pts">${weekPts} Pkt.</span>
      </div>
      ${tipsHtml || '<div style="padding:10px 14px;font-size:12px;color:var(--text-muted);">Noch keine Tipps.</div>'}
    </div>`;
  });
  html += '</div>';
  area.innerHTML = html;
}

// ===== INIT =====
async function init() {
  document.getElementById('tipper-form-area').innerHTML = '<div class="empty-hint">⏳ Daten werden geladen…</div>';
  await loadState();

  if (state.weeks.length === 0) {
    state.weeks.push({ id: "w_gp1", name: "Spieltag 1 – Gruppenphase (11.–17. Juni)", startDate: "2026-06-11", deadline: "2026-06-11T22:00:00", games: [
      { home: "Mexiko", away: "Südafrika", group: "Gruppe A", datetime: "11.06. 22:00 Uhr" },{ home: "Südkorea", away: "Tschechien", group: "Gruppe A", datetime: "12.06. 05:00 Uhr" },{ home: "Kanada", away: "Bosnien", group: "Gruppe B", datetime: "12.06. 22:00 Uhr" },{ home: "USA", away: "Paraguay", group: "Gruppe D", datetime: "13.06. 04:00 Uhr" },{ home: "Australien", away: "Türkei", group: "Gruppe D", datetime: "13.06. 07:00 Uhr" },{ home: "Katar", away: "Schweiz", group: "Gruppe B", datetime: "13.06. 22:00 Uhr" },{ home: "Brasilien", away: "Marokko", group: "Gruppe C", datetime: "14.06. 01:00 Uhr" },{ home: "Haiti", away: "Schottland", group: "Gruppe C", datetime: "14.06. 04:00 Uhr" },{ home: "Deutschland", away: "Curaçao", group: "Gruppe E", datetime: "14.06. 20:00 Uhr" },{ home: "Niederlande", away: "Japan", group: "Gruppe F", datetime: "14.06. 23:00 Uhr" },{ home: "Elfenbeinküste", away: "Ecuador", group: "Gruppe E", datetime: "15.06. 02:00 Uhr" },{ home: "Schweden", away: "Tunesien", group: "Gruppe F", datetime: "15.06. 05:00 Uhr" },{ home: "Spanien", away: "Kap Verde", group: "Gruppe H", datetime: "15.06. 19:00 Uhr" },{ home: "Belgien", away: "Ägypten", group: "Gruppe G", datetime: "15.06. 22:00 Uhr" },{ home: "Saudi-Arabien", away: "Uruguay", group: "Gruppe H", datetime: "16.06. 01:00 Uhr" },{ home: "Iran", away: "Neuseeland", group: "Gruppe G", datetime: "16.06. 04:00 Uhr" },{ home: "Frankreich", away: "Senegal", group: "Gruppe I", datetime: "16.06. 22:00 Uhr" },{ home: "Irak", away: "Norwegen", group: "Gruppe I", datetime: "17.06. 01:00 Uhr" },{ home: "Argentinien", away: "Algerien", group: "Gruppe J", datetime: "17.06. 04:00 Uhr" },{ home: "Österreich", away: "Jordanien", group: "Gruppe J", datetime: "17.06. 07:00 Uhr" },{ home: "Portugal", away: "DR Kongo", group: "Gruppe K", datetime: "17.06. 20:00 Uhr" },{ home: "England", away: "Kroatien", group: "Gruppe L", datetime: "17.06. 23:00 Uhr" },{ home: "Ghana", away: "Panama", group: "Gruppe L", datetime: "18.06. 02:00 Uhr" },{ home: "Usbekistan", away: "Kolumbien", group: "Gruppe K", datetime: "18.06. 05:00 Uhr" }
    ]});
    state.weeks.push({ id: "w_gp2", name: "Spieltag 2 – Gruppenphase (18.–24. Juni)", startDate: "2026-06-18", deadline: "2026-06-18T19:00:00", games: [
      { home: "Tschechien", away: "Südafrika", group: "Gruppe A", datetime: "18.06. 19:00 Uhr" },{ home: "Mexiko", away: "Südkorea", group: "Gruppe A", datetime: "19.06. 02:00 Uhr" },{ home: "Schweiz", away: "Bosnien", group: "Gruppe B", datetime: "18.06. 22:00 Uhr" },{ home: "Kanada", away: "Katar", group: "Gruppe B", datetime: "19.06. 01:00 Uhr" },{ home: "Schottland", away: "Marokko", group: "Gruppe C", datetime: "20.06. 01:00 Uhr" },{ home: "Brasilien", away: "Haiti", group: "Gruppe C", datetime: "20.06. 04:00 Uhr" },{ home: "Türkei", away: "Paraguay", group: "Gruppe D", datetime: "19.06. 07:00 Uhr" },{ home: "USA", away: "Australien", group: "Gruppe D", datetime: "19.06. 22:00 Uhr" },{ home: "Deutschland", away: "Elfenbeinküste", group: "Gruppe E", datetime: "20.06. 23:00 Uhr" },{ home: "Ecuador", away: "Curaçao", group: "Gruppe E", datetime: "21.06. 03:00 Uhr" },{ home: "Niederlande", away: "Schweden", group: "Gruppe F", datetime: "20.06. 20:00 Uhr" },{ home: "Tunesien", away: "Japan", group: "Gruppe F", datetime: "21.06. 07:00 Uhr" },{ home: "Belgien", away: "Iran", group: "Gruppe G", datetime: "21.06. 22:00 Uhr" },{ home: "Neuseeland", away: "Ägypten", group: "Gruppe G", datetime: "22.06. 04:00 Uhr" },{ home: "Spanien", away: "Saudi-Arabien", group: "Gruppe H", datetime: "21.06. 19:00 Uhr" },{ home: "Uruguay", away: "Kap Verde", group: "Gruppe H", datetime: "22.06. 01:00 Uhr" },{ home: "Frankreich", away: "Irak", group: "Gruppe I", datetime: "22.06. 23:00 Uhr" },{ home: "Norwegen", away: "Senegal", group: "Gruppe I", datetime: "23.06. 03:00 Uhr" },{ home: "Argentinien", away: "Österreich", group: "Gruppe J", datetime: "22.06. 20:00 Uhr" },{ home: "Jordanien", away: "Algerien", group: "Gruppe J", datetime: "23.06. 04:00 Uhr" },{ home: "Portugal", away: "Usbekistan", group: "Gruppe K", datetime: "23.06. 20:00 Uhr" },{ home: "Kolumbien", away: "DR Kongo", group: "Gruppe K", datetime: "24.06. 04:00 Uhr" },{ home: "England", away: "Ghana", group: "Gruppe L", datetime: "23.06. 23:00 Uhr" },{ home: "Panama", away: "Kroatien", group: "Gruppe L", datetime: "24.06. 02:00 Uhr" }
    ]});
    state.weeks.push({ id: "w_gp3", name: "Spieltag 3 – Gruppenphase (24.–28. Juni)", startDate: "2026-06-24", deadline: "2026-06-24T22:00:00", games: [
      { home: "Tschechien", away: "Mexiko", group: "Gruppe A", datetime: "25.06. 04:00 Uhr" },{ home: "Südafrika", away: "Südkorea", group: "Gruppe A", datetime: "25.06. 04:00 Uhr" },{ home: "Schweiz", away: "Kanada", group: "Gruppe B", datetime: "24.06. 22:00 Uhr" },{ home: "Bosnien", away: "Katar", group: "Gruppe B", datetime: "24.06. 22:00 Uhr" },{ home: "Schottland", away: "Brasilien", group: "Gruppe C", datetime: "25.06. 01:00 Uhr" },{ home: "Marokko", away: "Haiti", group: "Gruppe C", datetime: "25.06. 01:00 Uhr" },{ home: "Türkei", away: "USA", group: "Gruppe D", datetime: "26.06. 05:00 Uhr" },{ home: "Paraguay", away: "Australien", group: "Gruppe D", datetime: "26.06. 05:00 Uhr" },{ home: "Ecuador", away: "Deutschland", group: "Gruppe E", datetime: "25.06. 23:00 Uhr" },{ home: "Curaçao", away: "Elfenbeinküste", group: "Gruppe E", datetime: "25.06. 23:00 Uhr" },{ home: "Tunesien", away: "Niederlande", group: "Gruppe F", datetime: "26.06. 02:00 Uhr" },{ home: "Japan", away: "Schweden", group: "Gruppe F", datetime: "26.06. 02:00 Uhr" },{ home: "Neuseeland", away: "Belgien", group: "Gruppe G", datetime: "27.06. 06:00 Uhr" },{ home: "Ägypten", away: "Iran", group: "Gruppe G", datetime: "27.06. 06:00 Uhr" },{ home: "Uruguay", away: "Spanien", group: "Gruppe H", datetime: "27.06. 03:00 Uhr" },{ home: "Kap Verde", away: "Saudi-Arabien", group: "Gruppe H", datetime: "27.06. 03:00 Uhr" },{ home: "Norwegen", away: "Frankreich", group: "Gruppe I", datetime: "26.06. 22:00 Uhr" },{ home: "Senegal", away: "Irak", group: "Gruppe I", datetime: "26.06. 22:00 Uhr" },{ home: "Jordanien", away: "Argentinien", group: "Gruppe J", datetime: "28.06. 05:00 Uhr" },{ home: "Algerien", away: "Österreich", group: "Gruppe J", datetime: "28.06. 05:00 Uhr" },{ home: "Kolumbien", away: "Portugal", group: "Gruppe K", datetime: "28.06. 02:30 Uhr" },{ home: "DR Kongo", away: "Usbekistan", group: "Gruppe K", datetime: "28.06. 02:30 Uhr" },{ home: "Panama", away: "England", group: "Gruppe L", datetime: "28.06. 00:00 Uhr" },{ home: "Kroatien", away: "Ghana", group: "Gruppe L", datetime: "28.06. 00:00 Uhr" }
    ]});
    state.weeks.push({ id: "w_sf", name: "Sechzehntelfinale (28. Juni – 4. Juli)", startDate: "2026-06-28", deadline: "2026-06-28T22:00:00", games: [
      { home: "Zweiter A", away: "Zweiter B", group: "Sechzehntelfinale", datetime: "28.06. 22:00 Uhr" },{ home: "Erster C", away: "Zweiter F", group: "Sechzehntelfinale", datetime: "29.06. 20:00 Uhr" },{ home: "Erster E", away: "Bester Dritter A/B/C/D/F", group: "Sechzehntelfinale", datetime: "29.06. 23:30 Uhr" },{ home: "Erster F", away: "Zweiter C", group: "Sechzehntelfinale", datetime: "30.06. 03:00 Uhr" },{ home: "Zweiter E", away: "Zweiter I", group: "Sechzehntelfinale", datetime: "30.06. 20:00 Uhr" },{ home: "Erster I", away: "Bester Dritter C/D/F/G/H", group: "Sechzehntelfinale", datetime: "30.06. 00:00 Uhr" },{ home: "Erster A", away: "Bester Dritter C/E/F/H/I", group: "Sechzehntelfinale", datetime: "01.07. 03:00 Uhr" },{ home: "Erster L", away: "Bester Dritter E/H/I/J/K", group: "Sechzehntelfinale", datetime: "01.07. 19:00 Uhr" },{ home: "Erster G", away: "Bester Dritter A/E/H/I/J", group: "Sechzehntelfinale", datetime: "01.07. 23:00 Uhr" },{ home: "Erster D", away: "Bester Dritter B/E/F/I/J", group: "Sechzehntelfinale", datetime: "02.07. 03:00 Uhr" },{ home: "Erster H", away: "Zweiter J", group: "Sechzehntelfinale", datetime: "02.07. 22:00 Uhr" },{ home: "Zweiter K", away: "Zweiter L", group: "Sechzehntelfinale", datetime: "03.07. 02:00 Uhr" },{ home: "Erster B", away: "Bester Dritter E/F/G/I/J", group: "Sechzehntelfinale", datetime: "03.07. 06:00 Uhr" },{ home: "Zweiter D", away: "Zweiter G", group: "Sechzehntelfinale", datetime: "03.07. 21:00 Uhr" },{ home: "Erster J", away: "Zweiter H", group: "Sechzehntelfinale", datetime: "04.07. 01:00 Uhr" },{ home: "Erster K", away: "Bester Dritter D/E/I/J/L", group: "Sechzehntelfinale", datetime: "04.07. 04:30 Uhr" }
    ]});
    state.weeks.push({ id: "w_af", name: "Achtelfinale (4.–7. Juli)", startDate: "2026-07-04", deadline: "2026-07-04T20:00:00", games: [
      { home: "Sieger SF1", away: "Sieger SF3", group: "Achtelfinale", datetime: "04.07. 20:00 Uhr" },{ home: "Sieger SF2", away: "Sieger SF5", group: "Achtelfinale", datetime: "05.07. 00:00 Uhr" },{ home: "Sieger SF4", away: "Sieger SF6", group: "Achtelfinale", datetime: "05.07. 23:00 Uhr" },{ home: "Sieger SF7", away: "Sieger SF8", group: "Achtelfinale", datetime: "06.07. 03:00 Uhr" },{ home: "Sieger SF11", away: "Sieger SF12", group: "Achtelfinale", datetime: "06.07. 22:00 Uhr" },{ home: "Sieger SF9", away: "Sieger SF10", group: "Achtelfinale", datetime: "07.07. 03:00 Uhr" },{ home: "Sieger SF14", away: "Sieger SF16", group: "Achtelfinale", datetime: "07.07. 19:00 Uhr" },{ home: "Sieger SF13", away: "Sieger SF15", group: "Achtelfinale", datetime: "07.07. 23:00 Uhr" }
    ]});
    state.weeks.push({ id: "w_vf", name: "Viertelfinale (9.–12. Juli)", startDate: "2026-07-09", deadline: "2026-07-09T23:00:00", games: [
      { home: "Sieger AF1", away: "Sieger AF2", group: "Viertelfinale", datetime: "09.07. 23:00 Uhr" },{ home: "Sieger AF5", away: "Sieger AF6", group: "Viertelfinale", datetime: "10.07. 22:00 Uhr" },{ home: "Sieger AF3", away: "Sieger AF4", group: "Viertelfinale", datetime: "12.07. 00:00 Uhr" },{ home: "Sieger AF7", away: "Sieger AF8", group: "Viertelfinale", datetime: "12.07. 03:00 Uhr" }
    ]});
    state.weeks.push({ id: "w_hf", name: "Halbfinale (14.–15. Juli)", startDate: "2026-07-14", deadline: "2026-07-14T13:00:00", games: [
      { home: "Sieger VF1", away: "Sieger VF2", group: "Halbfinale", datetime: "14.07. 13:00 Uhr" },{ home: "Sieger VF3", away: "Sieger VF4", group: "Halbfinale", datetime: "15.07. 22:00 Uhr" }
    ]});
    state.weeks.push({ id: "w_finale", name: "Finale & Platz 3 (18.–19. Juli)", startDate: "2026-07-18", deadline: "2026-07-18T22:00:00", games: [
      { home: "Verlierer HF1", away: "Verlierer HF2", group: "Spiel um Platz 3", datetime: "18.07. 22:00 Uhr" },{ home: "Sieger HF1", away: "Sieger HF2", group: "🏆 Finale", datetime: "19.07. 22:00 Uhr" }
    ]});
    await saveState();
  }

  renderSettings();
  renderTipTab();
}

init();
let lastScroll = 0;

window.addEventListener("scroll", () => {
  const header = document.querySelector("header");
  const current = window.pageYOffset;

  if(current > lastScroll && current > 100){
    header.classList.add("hide");
  } else {
    header.classList.remove("hide");
  }   

  lastScroll = current;
});