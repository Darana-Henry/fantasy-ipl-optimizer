import { TEAM_MAP } from './config.js';
import { isTodayOrFuture, formatDate } from './utils.js';

export function buildPastTeamSchedules(rawFixtures) {
  const sched = {};
  const past  = rawFixtures
    .filter(f => {
      const match = f['Match'] || '';
      if (!match || match.includes('TBD')) return false;
      return !isTodayOrFuture(f['Date']);
    })
    .sort((a, b) => parseInt(a['#']) - parseInt(b['#']));

  for (const f of past) {
    const fixNum   = parseInt(f['#']);
    const match    = f['Match'] || '';
    const dateStr  = formatDate(f['Date']);
    const homeFull = f['Home Team'] || '';
    const awayFull = f['Away Team'] || '';
    const home = Object.entries(TEAM_MAP).find(([full]) => homeFull.includes(full))?.[1] || '';
    const away = Object.entries(TEAM_MAP).find(([full]) => awayFull.includes(full))?.[1] || '';
    if (!home || !away) continue;

    if (!sched[home]) sched[home] = [];
    if (!sched[away]) sched[away] = [];
    sched[home].push({ fix: fixNum, date: dateStr, opponent: away,  match });
    sched[away].push({ fix: fixNum, date: dateStr, opponent: home,  match });
  }
  return sched;
}

// ── FOREIGN ROYALE ────────────────────────────────────────────────────────

export function buildForeignRoyaleData(players, playedMDs, rawFixtures) {
  const sched      = buildPastTeamSchedules(rawFixtures);
  const foreigners = players.filter(p => p.status === 'Foreign' && p.total > 0);
  const fixtureScores = {};

  for (const p of foreigners) {
    const teamSched = sched[p.team] || [];
    for (let i = 0; i < teamSched.length; i++) {
      const md    = playedMDs[i];
      if (!md) continue;
      const raw   = p._raw ? p._raw[md] : 0;
      const score = typeof raw === 'number' ? raw : parseFloat(raw) || 0;
      if (score <= 0) continue;
      const game = teamSched[i];
      if (!fixtureScores[game.fix]) fixtureScores[game.fix] = { ...game, players: [] };
      fixtureScores[game.fix].players.push({ name: p.name, team: p.team, score });
    }
  }

  const results = [];
  for (const [fixNum, game] of Object.entries(fixtureScores)) {
    const top4   = game.players.sort((a, b) => b.score - a.score).slice(0, 4);
    if (top4.length < 2) continue;
    const scores = top4.map(p => p.score);
    const asc    = [...scores].sort((a, b) => a - b);
    const best   = scores[0] * 4 + scores[1] * 3 + scores.slice(2).reduce((a, b) => a + (b * 2), 0);
    const worst  = asc[0] * 4 + asc[1] * 3 + asc.slice(2).reduce((a, b) => a + (b * 2), 0);
    const actual = scores.reduce((a, b) => a + b, 0);

    results.push({
      fix: parseInt(fixNum), date: game.date, match: game.match,
      top4, best, worst, actual,
      searchStr: [game.match, game.date, ...top4.map(p => p.name + ' ' + p.team)].join(' ').toLowerCase(),
    });
  }

  return results.sort((a, b) => b.actual - a.actual);
}

function hrPlayerRow(p, rank, isBestC, isBestVC, isWorstC, isWorstVC) {
  const rankCls   = ['hr-p1', 'hr-p2', 'hr-p3', 'hr-p4'][rank - 1] || 'hr-p4';
  const rankLabel = ['1st', '2nd', '3rd', '4th'][rank - 1];
  let tags = '';
  if (isBestC)   tags += '<span class="hr-multiplier hr-cap">👑 C (Best)</span>';
  if (isBestVC)  tags += '<span class="hr-multiplier hr-vc">🥈 VC (Best)</span>';
  if (isWorstC)  tags += '<span class="hr-multiplier hr-cap" style="opacity:0.5">👑 C (Worst)</span>';
  if (isWorstVC) tags += '<span class="hr-multiplier hr-vc"  style="opacity:0.5">🥈 VC (Worst)</span>';
  return `
  <div class="hr-player-row">
    <div class="hr-player-rank ${rankCls}">${rankLabel}</div>
    <div>
      <span class="player-name-cell" style="display:inline-flex;gap:6px;align-items:center">
        <span class="team-dot team-${p.team}"></span>
        <span class="hr-player-name">${p.name}</span>
        <span class="team-tag tag-${p.team}">${p.team}</span>
      </span>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
      ${tags}
      <div class="hr-player-score">${p.score}</div>
    </div>
  </div>`;
}

function buildHRCard(game, idx) {
  const id     = 'hr-' + idx + '-' + Math.random().toString(36).slice(2, 5);
  const top4   = game.top4;
  const scores = top4.map(p => p.score);
  const asc    = [...scores].map((s, i) => i).sort((a, b) => scores[a] - scores[b]);
  const worstCIdx  = asc[0];
  const worstVCIdx = asc[1];

  const rows = top4.map((p, i) => hrPlayerRow(
    p, i + 1,
    i === 0, i === 1,
    i === worstCIdx, i === worstVCIdx
  )).join('');

  return `
  <div class="hr-card" id="${id}" data-search="${game.searchStr}">
    <div class="hr-header">
      <div class="rank-circle rank-other" style="font-size:0.8rem;width:42px;height:42px">#${idx}</div>
      <div class="hr-match-info">
        <div class="hr-match-num">Fixture #${game.fix}</div>
        <div class="hr-match-name">${game.match}</div>
        <div class="hr-match-date">📅 ${game.date}</div>
      </div>
      <div class="hr-scenarios">
        <div class="hr-scenario hr-best"><div class="hr-val">${game.best}</div><div class="hr-lbl">Best</div></div>
        <div class="hr-scenario hr-actual"><div class="hr-val">${game.actual}</div><div class="hr-lbl">Actual</div></div>
        <div class="hr-scenario hr-worst"><div class="hr-val">${game.worst}</div><div class="hr-lbl">Worst</div></div>
      </div>
      <span class="hr-expand">▼</span>
    </div>
    <div class="hr-body">
      ${rows}
      <div class="hr-scenario-note">
        <strong style="color:#4ade80">Best case:</strong> Captain <strong>${top4[0].name}</strong>
        (×4 = ${top4[0].score * 4} pts) + VC <strong>${top4[1].name}</strong>
        (×3 = ${top4[1].score * 3} pts) + others ×2 = <strong>${game.best} total</strong><br>
        <strong style="color:#f87171">Worst case:</strong> Captain <strong>${top4[worstCIdx].name}</strong>
        (×4 = ${top4[worstCIdx].score * 4} pts) + VC <strong>${top4[worstVCIdx].name}</strong>
        (×3 = ${top4[worstVCIdx].score * 3} pts) + others ×2 = <strong>${game.worst} total</strong>
      </div>
    </div>
  </div>`;
}

let hrAllData = [];

export function renderForeignRoyale(data) {
  hrAllData = data;
  const container = document.getElementById('cards-history');
  container.innerHTML = data.map((g, i) => buildHRCard(g, i + 1)).join('');
  document.getElementById('count-history').textContent = `${data.length} past fixtures`;
  document.getElementById('info-history').innerHTML = `
    <div class="info-chip">🏆 <strong>${data.length}</strong> past fixtures · sorted by highest Actual score</div>
    <div class="info-chip">👑 Captain = 4× &nbsp;|&nbsp; 🥈 VC = 3× &nbsp;|&nbsp; Others = 2×</div>
    <div class="info-chip">🟢 Best = C on #1, VC on #2 &nbsp;|&nbsp; 🔴 Worst = C on #4, VC on #3</div>
    <div class="info-chip">📋 Click any fixture to expand player breakdown</div>`;

  container.addEventListener('click', e => {
    const header = e.target.closest('.hr-header');
    if (header) header.closest('.hr-card').classList.toggle('expanded');
  });
}

export function filterHistory() {
  const q     = document.getElementById('search-history').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#cards-history .hr-card');
  let vis = 0;
  cards.forEach(c => {
    const show = !q || c.getAttribute('data-search').includes(q);
    c.style.display = show ? '' : 'none';
    if (show) vis++;
  });
  document.getElementById('count-history').textContent =
    vis < cards.length ? `Showing ${vis} of ${cards.length} fixtures` : `${cards.length} past fixtures`;

  const container = document.getElementById('cards-history');
  const empty = container.querySelector('.empty');
  if (vis === 0 && q) {
    if (!empty) container.insertAdjacentHTML('beforeend',
      `<div class="empty"><div class="icon">🔍</div><div>No matches for "<strong>${q}</strong>"</div></div>`);
  } else if (empty) {
    empty.remove();
  }
}

// ── INDIAN ROYALE ─────────────────────────────────────────────────────────

export function buildIndianRoyaleData(players, playedMDs, rawFixtures) {
  const sched   = buildPastTeamSchedules(rawFixtures);
  const indians = players.filter(p => p.status === 'Indian' && p.total > 0);
  const fixtureScores = {};

  for (const p of indians) {
    const teamSched = sched[p.team] || [];
    for (let i = 0; i < teamSched.length; i++) {
      const md    = playedMDs[i];
      if (!md) continue;
      const raw   = p._raw ? p._raw[md] : 0;
      const score = typeof raw === 'number' ? raw : parseFloat(raw) || 0;
      if (score <= 0) continue;
      const game = teamSched[i];
      if (!fixtureScores[game.fix]) fixtureScores[game.fix] = { ...game, players: [] };
      fixtureScores[game.fix].players.push({ name: p.name, team: p.team, score });
    }
  }

  const results = [];
  for (const [fixNum, game] of Object.entries(fixtureScores)) {
    const allSorted = game.players.sort((a, b) => b.score - a.score);
    const teamCount = {};
    const top11     = [];
    for (const p of allSorted) {
      teamCount[p.team] = (teamCount[p.team] || 0);
      if (teamCount[p.team] < 7) { top11.push(p); teamCount[p.team]++; }
      if (top11.length === 11) break;
    }
    if (top11.length < 2) continue;

    const scores = top11.map(p => p.score);
    const asc    = [...scores].sort((a, b) => a - b);
    const best   = scores[0] * 4 + scores[1] * 3 + scores.slice(2).reduce((a, b) => a + (b * 2), 0);
    const worst  = asc[0] * 4 + asc[1] * 3 + asc.slice(2).reduce((a, b) => a + (b * 2), 0);
    const actual = scores.reduce((a, b) => a + b, 0);

    results.push({
      fix: parseInt(fixNum), date: game.date, match: game.match,
      top11, best, worst, actual, teamCount,
      searchStr: [game.match, game.date, ...top11.map(p => p.name + ' ' + p.team)].join(' ').toLowerCase(),
    });
  }

  return results.sort((a, b) => b.actual - a.actual);
}

function irPlayerRow(p, rank, isBestC, isBestVC, isWorstC, isWorstVC) {
  const rankLabels = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th'];
  const rankColors = ['hr-p1','hr-p2','hr-p3','hr-p4','hr-p4','hr-p4','hr-p4','hr-p4','hr-p4','hr-p4','hr-p4'];
  const rankCls    = rankColors[rank - 1] || 'hr-p4';
  const rankLabel  = rankLabels[rank - 1] || `${rank}th`;
  let tags = '';
  if (isBestC)   tags += '<span class="hr-multiplier hr-cap">👑 C (Best)</span>';
  if (isBestVC)  tags += '<span class="hr-multiplier hr-vc">🥈 VC (Best)</span>';
  if (isWorstC)  tags += '<span class="hr-multiplier hr-cap" style="opacity:0.5">👑 C (Worst)</span>';
  if (isWorstVC) tags += '<span class="hr-multiplier hr-vc"  style="opacity:0.5">🥈 VC (Worst)</span>';
  if (!isBestC && !isBestVC && !isWorstC && !isWorstVC)
    tags += '<span class="hr-multiplier" style="background:rgba(79,145,205,0.15);color:var(--ipl-sky);border:1px solid rgba(79,145,205,0.3)">×2</span>';
  return `
  <div class="hr-player-row">
    <div class="hr-player-rank ${rankCls}">${rankLabel}</div>
    <div>
      <span class="player-name-cell" style="display:inline-flex;gap:6px;align-items:center">
        <span class="team-dot team-${p.team}"></span>
        <span class="hr-player-name">${p.name}</span>
        <span class="team-tag tag-${p.team}">${p.team}</span>
      </span>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
      ${tags}
      <div class="hr-player-score">${p.score}</div>
    </div>
  </div>`;
}

function buildIRCard(game, idx) {
  const id     = 'ir-' + idx + '-' + Math.random().toString(36).slice(2, 5);
  const top11  = game.top11;
  const scores = top11.map(p => p.score);
  const asc    = [...scores].map((s, i) => i).sort((a, b) => scores[a] - scores[b]);
  const worstCIdx  = asc[0];
  const worstVCIdx = asc[1];

  const teamDist = Object.entries(game.teamCount)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `<span class="team-tag tag-${t}" style="font-size:0.68rem">${t}: ${c}</span>`)
    .join('');

  const rows = top11.map((p, i) => irPlayerRow(
    p, i + 1,
    i === 0, i === 1,
    i === worstCIdx, i === worstVCIdx
  )).join('');

  return `
  <div class="hr-card" id="${id}" data-search="${game.searchStr}">
    <div class="hr-header">
      <div class="rank-circle rank-other" style="font-size:0.8rem;width:42px;height:42px">#${idx}</div>
      <div class="hr-match-info">
        <div class="hr-match-num">Fixture #${game.fix}</div>
        <div class="hr-match-name">${game.match}</div>
        <div class="hr-match-date">📅 ${game.date}</div>
      </div>
      <div class="hr-scenarios">
        <div class="hr-scenario hr-best"><div class="hr-val">${game.best}</div><div class="hr-lbl">Best</div></div>
        <div class="hr-scenario hr-actual"><div class="hr-val">${game.actual}</div><div class="hr-lbl">Actual</div></div>
        <div class="hr-scenario hr-worst"><div class="hr-val">${game.worst}</div><div class="hr-lbl">Worst</div></div>
      </div>
      <span class="hr-expand">▼</span>
    </div>
    <div class="hr-body">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
        <span style="font-size:0.72rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.4px;">Team split:</span>
        ${teamDist}
      </div>
      ${rows}
      <div class="hr-scenario-note">
        <strong style="color:#4ade80">Best case:</strong> Captain <strong>${top11[0].name}</strong>
        (×4 = ${top11[0].score * 4} pts) + VC <strong>${top11[1].name}</strong>
        (×3 = ${top11[1].score * 3} pts) + other 9 players ×2 = <strong>${game.best} total</strong><br>
        <strong style="color:#f87171">Worst case:</strong> Captain <strong>${top11[worstCIdx].name}</strong>
        (×4 = ${top11[worstCIdx].score * 4} pts) + VC <strong>${top11[worstVCIdx].name}</strong>
        (×3 = ${top11[worstVCIdx].score * 3} pts) + other 9 players ×2 = <strong>${game.worst} total</strong>
      </div>
    </div>
  </div>`;
}

export function renderIndianRoyale(data) {
  const container = document.getElementById('cards-indianroyale');
  container.innerHTML = data.map((g, i) => buildIRCard(g, i + 1)).join('');
  document.getElementById('count-indianroyale').textContent = `${data.length} past fixtures`;
  document.getElementById('info-indianroyale').innerHTML = `
    <div class="info-chip">🇮🇳 <strong>${data.length}</strong> past fixtures · sorted by highest Actual score</div>
    <div class="info-chip">👑 Captain = 4× &nbsp;|&nbsp; 🥈 VC = 3× &nbsp;|&nbsp; Others (×9) = 2× each</div>
    <div class="info-chip">✅ Max 7 players from one team &nbsp;|&nbsp; Top 11 Indians selected per game</div>
    <div class="info-chip">🟢 Best = C on #1, VC on #2 &nbsp;|&nbsp; 🔴 Worst = C on #11, VC on #10</div>`;

  container.addEventListener('click', e => {
    const header = e.target.closest('.hr-header');
    if (header) header.closest('.hr-card').classList.toggle('expanded');
  });
}

export function filterIndianRoyale() {
  const q     = document.getElementById('search-indianroyale').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#cards-indianroyale .hr-card');
  let vis = 0;
  cards.forEach(c => {
    const show = !q || c.getAttribute('data-search').includes(q);
    c.style.display = show ? '' : 'none';
    if (show) vis++;
  });
  document.getElementById('count-indianroyale').textContent =
    vis < cards.length ? `Showing ${vis} of ${cards.length} fixtures` : `${cards.length} past fixtures`;

  const container = document.getElementById('cards-indianroyale');
  const empty = container.querySelector('.empty');
  if (vis === 0 && q) {
    if (!empty) container.insertAdjacentHTML('beforeend',
      `<div class="empty"><div class="icon">🔍</div><div>No matches for "<strong>${q}</strong>"</div></div>`);
  } else if (empty) {
    empty.remove();
  }
}
