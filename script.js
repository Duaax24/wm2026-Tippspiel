// ===== STATE =====
const AHK_PLAYERS = [
  'Aleksander Rachkovski',
  'Audronė Gurinskienė',
  'Clara Bommersbach',
  'David Hoffmann',
  'Dominic Otto',
  'Dr. Inga Laurušonė',
  'Duaa Fourah',
  'Edgars Ločmelis',
  'Egita Proveja',
  'Elo Saari',
  'Eugenijus Vaitekūnas',
  'Eve Vendelin',
  'Felix Doerfel',
  'Florian Schröder',
  'Ieva Mālmane',
  'Inese Reipa',
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

let state = {
  players: [...AHK_PLAYERS],
  weeks: [],
  tips: {},     // tips[weekId][playerName] = [{home,away},...] per game
  results: {}   // results[weekId] = [{home,away},...] per game (real scores)
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
  await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: sbHeaders,
    body: JSON.stringify(data)
  });
}

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
function showTab(name) {
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
    grid.innerHTML = '<p style="font-size:14px;color:var(--text-muted);">Noch keine Teilnehmer registriert.</p>';
  } else {
    grid.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">` +
      players.map(p => `
        <div style="display:flex;align-items:center;gap:6px;background:var(--dark-2);border:1px solid var(--dark-4);border-radius:8px;padding:6px 12px;">
          <span style="font-size:14px;font-weight:500;">${p}</span>
          <button onclick="removePlayer('${p}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;line-height:1;padding:0 2px;" title="Entfernen">×</button>
        </div>`).join('') +
      `</div>`;
  }
  renderWeekManager();
}

function showRegister() {
  document.getElementById('register-area').style.display = 'block';
  document.getElementById('new-player-input').focus();
}
function hideRegister() {
  document.getElementById('register-area').style.display = 'none';
  document.getElementById('new-player-input').value = '';
}

function registerPlayer() {
  const input = document.getElementById('new-player-input');
  const name = input.value.trim();
  if (!name) { toast('Bitte einen Namen eingeben.'); return; }
  if (state.players.includes(name)) {
    toast(`"${name}" ist bereits registriert.`);
    // still select them
    hideRegister();
    populatePlayerSelect();
    document.getElementById('tipper-select').value = name;
    loadTipperForm();
    return;
  }
  state.players.push(name);
  saveState();
  hideRegister();
  populatePlayerSelect();
  document.getElementById('tipper-select').value = name;
  loadTipperForm();
  toast(`${name} registriert ✓`);
}

function removePlayer(name) {
  if (!confirm(`"${name}" wirklich entfernen?`)) return;
  state.players = state.players.filter(p => p !== name);
  saveState();
  renderSettings();
}

function onTipperSelectChange() {
  loadTipperForm();
}

function resetAll() {
  if (!confirm('Wirklich ALLES zurücksetzen? Alle Tipps und Ergebnisse gehen verloren!')) return;
  state = { players: [...AHK_PLAYERS], weeks: [], tips: {}, results: {} };
  saveState();
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
        <input style="background:transparent;border:none;border-bottom:1px solid #d0d5de;color:#1a3fa8;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;padding:2px 4px;width:220px;" 
          value="${w.name}" onchange="state.weeks[${wi}].name=this.value;saveState();" placeholder="Woche 1 – Gruppenphase">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div>
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:2px;">Erste Spiele am:</label>
            <input type="date" style="background:#fff;border:1px solid var(--dark-4);border-radius:6px;padding:4px 8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;" 
              value="${w.startDate||''}" onchange="state.weeks[${wi}].startDate=this.value;delete state.weeks[${wi}].deadline;saveState();renderWeekManager();">
          </div>
          <div style="font-size:11px;color:var(--text-muted);">
            Deadline:<br><strong style="color:var(--text);">${deadlineInfo}</strong><br><span style="color:${locked?'var(--red)':'var(--green)'}">${locked?'🔒 Gesperrt':'🟢 Offen'}</span>
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
        placeholder="Heimteam" value="${g.home||''}" onchange="state.weeks[${wi}].games[${gi}].home=this.value;saveState();">
      <span style="color:var(--text-muted);font-size:12px;">vs</span>
      <input style="background:var(--dark-3);border:1px solid var(--dark-4);border-radius:6px;padding:6px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;" 
        placeholder="Auswärtsteam" value="${g.away||''}" onchange="state.weeks[${wi}].games[${gi}].away=this.value;saveState();">
      <input style="background:var(--dark-3);border:1px solid var(--dark-4);border-radius:6px;padding:6px 8px;color:var(--text-muted);font-family:'DM Sans',sans-serif;font-size:11px;width:80px;" 
        placeholder="Gruppe A" value="${g.group||''}" onchange="state.weeks[${wi}].games[${gi}].group=this.value;saveState();">
      <button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px 8px;" onclick="removeGame(${wi},${gi})">×</button>
    </div>
  `).join('');
}

function addWeek() {
  const id = 'w' + Date.now();
  state.weeks.push({ id, name: `Woche ${state.weeks.length+1}`, deadline: '', games: [] });
  saveState();
  renderWeekManager();
}

function removeWeek(wi) {
  if (!confirm('Woche und alle zugehörigen Tipps löschen?')) return;
  const id = state.weeks[wi].id;
  state.weeks.splice(wi, 1);
  delete state.tips[id];
  delete state.results[id];
  saveState();
  renderWeekManager();
}

function addGame(wi) {
  if (!state.weeks[wi].games) state.weeks[wi].games = [];
  state.weeks[wi].games.push({ home: '', away: '', group: '' });
  saveState();
  renderGamesInWeek(wi);
}

function removeGame(wi, gi) {
  state.weeks[wi].games.splice(gi, 1);
  saveState();
  renderGamesInWeek(wi);
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
      🔒 Deadline abgelaufen – Tipps gesperrt
    </div>`;
  }

  html += '<div class="games-list">';
  games.forEach((g, gi) => {
    const t = existing[gi] || {home:'',away:''};
    const locked = isLocked ? 'disabled' : '';
    html += `
      <div class="game-card ${isLocked?'locked':''}">
        <div class="game-meta">
          <span class="game-group-badge">${g.group||'Gruppe ?'}</span>
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
  toast(`Tipps werden gespeichert…`);
  await saveTipToDb(weekId, player, tips);
  toast(`Tipps von ${player} gespeichert ✓`);
}

function isWeekLocked(week) {
  // Use explicit deadline if set, otherwise auto: 23:59 day before week start
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
          <span class="game-group-badge">${g.group||'?'}</span>
          <span class="game-date">Ergebnis</span>
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

  let pts = 0;
  // Exact score: 5 pts
  if (th === rh && ta === ra) { pts = 5; return { pts, label: 'exact' }; }

  // Correct outcome: 3 pts
  const tipOut = th > ta ? 'H' : th < ta ? 'A' : 'D';
  const resOut = rh > ra ? 'H' : rh < ra ? 'A' : 'D';
  if (tipOut === resOut) {
    pts = 3;
    // Bonus: one correct score: +1
    if (th === rh || ta === ra) pts = 4;
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
      if (r) {
        const p = calcPoints(t, r);
        if (p) { total += p.pts; if (p.label==='exact') exact++; }
      }
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
  if (players.length === 0) {
    area.innerHTML = '<div class="empty-hint">Noch keine Spieler eingetragen.</div>';
    return;
  }

  const ranked = players.map(p => {
    const { total, exact } = getPlayerTotalPoints(p, weekId);
    return { name: p, total, exact };
  }).sort((a,b) => b.total - a.total || b.exact - a.exact);

  let html = '<table class="ranking-table"><thead><tr><th>Platz</th><th>Name</th><th style="text-align:right">Punkte</th><th style="text-align:right">Exakt</th></tr></thead><tbody>';
  ranked.forEach((r,i) => {
    html += `<tr class="rank-${i+1}">
      <td class="rank-num">${i+1}</td>
      <td class="rank-name">${r.name}</td>
      <td class="rank-pts">${r.total}</td>
      <td class="rank-exact">🎯 ${r.exact}</td>
    </tr>`;
  });
  html += '</tbody></table>';

  // Points legend
  html += `<div style="background:var(--dark-2);border:1px solid var(--dark-4);border-radius:8px;padding:12px 16px;font-size:13px;color:var(--text-muted);">
    <strong style="color:var(--text)">Punktesystem:</strong> &nbsp;
    Exaktes Ergebnis = <strong style="color:#1a3fa8">5 Punkte</strong> &nbsp;|&nbsp;
    Richtiger Ausgang + ein korrektes Tor = <strong style="color:#1a3fa8">4 Punkte</strong> &nbsp;|&nbsp;
    Richtiger Ausgang = <strong style="color:#1a3fa8">3 Punkte</strong>
  </div>`;

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
          if (p) {
            weekPts += p.pts;
            cls = p.label;
          }
        } else {
          cls = 'pending';
        }
      }

      tipsHtml += `<div class="tip-row">
        <span class="tip-match">${g.home||'?'} – ${g.away||'?'}</span>
        <span class="tip-score ${cls}">${scoreLabel}</span>
      </div>`;
    });

    html += `<div class="tip-card">
      <div class="tip-card-header">
        ${player}
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
  // Show loading indicator
  document.getElementById('tipper-form-area').innerHTML = '<div class="empty-hint">⏳ Daten werden geladen…</div>';

  await loadState();

  // Add default weeks if DB is empty
  if (state.weeks.length === 0) {
    state.weeks.push({
      id: 'w_gp1',
      name: 'Woche 1 – Gruppenphase (11.–17. Juni)',
      startDate: '2026-06-11',
      games: [
        { home: 'Mexiko', away: 'Südafrika', group: 'Gruppe A' },
        { home: 'Südkorea', away: 'Tschechien', group: 'Gruppe A' },
        { home: 'Kanada', away: 'Bosnien', group: 'Gruppe B' },
        { home: 'Deutschland', away: 'Curaçao', group: 'Gruppe E' },
        { home: 'Brasilien', away: 'Schottland', group: 'Gruppe C' },
        { home: 'USA', away: 'Türkei', group: 'Gruppe D' },
        { home: 'Frankreich', away: 'Irak', group: 'Gruppe I' },
        { home: 'Spanien', away: 'Kap Verde', group: 'Gruppe H' },
      ]
    });
    state.weeks.push({
      id: 'w_gp2',
      name: 'Woche 2 – Gruppenphase (18.–24. Juni)',
      startDate: '2026-06-18',
      games: [
        { home: 'Mexiko', away: 'Tschechien', group: 'Gruppe A' },
        { home: 'Südafrika', away: 'Südkorea', group: 'Gruppe A' },
        { home: 'Deutschland', away: 'Elfenbeinküste', group: 'Gruppe E' },
        { home: 'Argentinien', away: 'Algerien', group: 'Gruppe J' },
        { home: 'Portugal', away: 'Usbekistan', group: 'Gruppe K' },
        { home: 'Niederlande', away: 'Schweden', group: 'Gruppe F' },
        { home: 'England', away: 'Panama', group: 'Gruppe L' },
        { home: 'Belgien', away: 'Neuseeland', group: 'Gruppe G' },
      ]
    });
    await saveState();
  }

  renderSettings();
  renderTipTab();
}

init();
