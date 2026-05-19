import { TEAM_MAP } from './config.js';
import { isTodayOrFuture, posAbbr, rankClass, momentumArrow, formatDate } from './utils.js';

export function rankFixtures(players, fixtures, statusFilter, maxPlayers) {
  const filtered = players.filter(p => p.status === statusFilter && p.total > 0);
  const results  = [];

  for (const fix of fixtures) {
    const md    = parseInt(fix['#']);
    const match = fix['Match'] || '';
    if (!match || match.includes('TBD')) continue;
    if (!isTodayOrFuture(fix['Date'])) continue;

    const teams = Object.entries(TEAM_MAP)
      .filter(([full]) => match.includes(full))
      .map(([, code]) => code);
    if (teams.length < 2) continue;

    const inMatch = filtered.filter(p =>
      teams.includes(p.team) && (p.last4Games || 0) >= 3
    );
    const topN = inMatch.sort((a, b) => b.composite - a.composite).slice(0, maxPlayers);
    if (!topN.length) continue;

    results.push({
      md,
      date:    formatDate(fix['Date']),
      match,
      score:   Math.round(topN.reduce((s, p) => s + p.composite, 0) * 10) / 10,
      players: topN,
    });
  }

  // Assign priority rank by composite score before re-sorting chronologically
  const byScore = [...results].sort((a, b) => b.score - a.score);
  byScore.forEach((item, i) => { item.priority = i + 1; });

  return results.sort((a, b) => a.md - b.md);
}

function buildPlayerRows(players) {
  return players.map(p => `
    <tr class="row-${p.team}">
      <td>
        <div class="player-name-cell">
          <span class="team-dot team-${p.team}"></span>
          <span class="pname">${p.name}</span>
          <span class="team-tag tag-${p.team}">${p.team}</span>
        </div>
      </td>
      <td><span class="pos-tag">${posAbbr(p.position)}</span></td>
      <td class="price-text col-hide">₹${p.price}Cr</td>
      <td class="center sep-col stat-played">${p.played}</td>
      <td class="stat-total">${p.total}</td>
      <td class="stat-avg col-hide">${p.avg}</td>
      <td class="center sep-col stat-l4games">${p.last4Games}</td>
      <td class="stat-l4total">${p.last4}</td>
      <td class="stat-l4avg col-hide">${p.last4Avg}</td>
      <td class="center sep-col" style="color:#c084fc;font-weight:700;font-size:1rem">${p.composite}</td>
      <td class="col-hide" style="color:var(--text-secondary);font-size:0.82rem">${p.wAvg}</td>
      <td class="center col-hide" style="color:#f87171;font-size:0.8rem">${p.penalty > 0 ? '-' + p.penalty + '%' : '—'}</td>
      <td class="center col-hide">${momentumArrow(p.momentum)}<span style="font-size:0.75rem;color:var(--text-secondary);margin-left:2px">${p.momentum > 0 ? '+' : ''}${p.momentum}%</span></td>
      <td class="col-hide" style="font-size:0.78rem;color:var(--text-secondary)">${(p.recentScores || []).join(', ')}</td>
    </tr>`).join('');
}

function buildCard(item, rank) {
  const id       = 'card-' + rank + '-' + Math.random().toString(36).slice(2, 6);
  const search   = [item.match, item.date, ...item.players.map(p => p.name + ' ' + p.team)].join(' ').toLowerCase();
  const priority = item.priority || rank;
  const priClass = rankClass(priority);

  return `
  <div class="match-card" id="${id}" data-search="${search}">
    <div class="match-card-header">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">
        <div style="font-size:0.62rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.4px">Game</div>
        <div class="rank-circle rank-other" style="width:38px;height:38px;font-size:0.9rem">#${rank}</div>
      </div>
      <div class="match-meta">
        <div class="match-md">MD #${item.md}</div>
        <div class="match-name">${item.match}</div>
        <div class="match-date">📅 ${item.date}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">
        <div style="font-size:0.62rem;color:var(--ipl-gold);text-transform:uppercase;letter-spacing:0.4px">Priority</div>
        <div class="rank-circle ${priClass}" style="width:38px;height:38px;font-size:0.9rem">#${priority}</div>
      </div>
      <div class="match-score-block">
        <div class="match-score-num">${item.score}</div>
        <div class="match-score-lbl">Combined ⚡ Score</div>
      </div>
      <span class="expand-icon">▼</span>
    </div>
    <div class="players-section">
      <div class="section-divider">
        <span class="overall-badge">📊 Overall Form</span>
        <span class="last4-badge">🔥 Last 4 Games</span>
        <span style="background:rgba(192,132,252,0.15);color:#c084fc;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px">⚡ Composite Score</span>
      </div>
      <table class="players-table">
        <thead>
          <tr>
            <th colspan="2">Player</th>
            <th class="col-hide">Price</th>
            <th class="center sep-col overall-col" title="Total Games Played">GP</th>
            <th class="overall-col">Total Pts</th>
            <th class="overall-col col-hide">Avg/Game</th>
            <th class="center sep-col last4-col" title="Games in Last 4 MDs">L4 GP</th>
            <th class="last4-col">L4 Pts</th>
            <th class="last4-col col-hide">L4 Avg</th>
            <th class="center sep-col" style="color:#c084fc;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px" title="Weighted Avg × (1 − Variance + Momentum)">⚡ Score</th>
            <th class="col-hide" style="color:#c084fc;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px" title="Weighted Recency Average">W.Avg</th>
            <th class="center col-hide" style="color:#f87171;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px" title="Consistency penalty — higher = more volatile">Variance</th>
            <th class="center col-hide" style="color:#4ade80;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px" title="Is the player trending up or down?">Trend</th>
            <th class="col-hide" style="color:var(--text-secondary);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px">Recent Scores</th>
          </tr>
        </thead>
        <tbody>${buildPlayerRows(item.players)}</tbody>
      </table>
    </div>
  </div>`;
}

export function renderRankings(type, rankings, last4MDs) {
  const container = document.getElementById('cards-' + type);
  container.innerHTML = rankings.map((item, i) => buildCard(item, i + 1)).join('');
  updateCount(type, rankings.length, rankings.length);

  document.getElementById('info-' + type).innerHTML = `
    <div class="info-chip">📅 <strong>${rankings.length}</strong> upcoming fixtures · shown in date order</div>
    <div class="info-chip">🔥 Form window: <strong>${last4MDs.join(' · ')}</strong></div>
    <div class="info-chip">⚡ <strong>Priority #</strong> = composite score rank (1 = best booster opportunity)</div>
    <div class="info-chip">📊 Composite Score = Weighted Avg × (1 − Variance + Momentum)</div>`;

  // Expand/collapse on header click via event delegation
  container.addEventListener('click', e => {
    const header = e.target.closest('.match-card-header');
    if (header) header.closest('.match-card').classList.toggle('expanded');
  });
}

export function filterCards(type) {
  const q     = document.getElementById('search-' + type).value.toLowerCase().trim();
  const cards = document.querySelectorAll('#cards-' + type + ' .match-card');
  let vis = 0;
  cards.forEach(c => {
    const show = !q || c.getAttribute('data-search').includes(q);
    c.style.display = show ? '' : 'none';
    if (show) vis++;
  });
  updateCount(type, vis, cards.length);

  const container = document.getElementById('cards-' + type);
  const empty = container.querySelector('.empty');
  if (vis === 0 && q) {
    if (!empty) container.insertAdjacentHTML('beforeend',
      `<div class="empty"><div class="icon">🔍</div><div>No matches for "<strong>${q}</strong>"</div></div>`);
  } else if (empty) {
    empty.remove();
  }
}

export function updateCount(type, vis, total) {
  const el = document.getElementById('count-' + type);
  if (el) el.textContent = vis < total ? `Showing ${vis} of ${total}` : `${total} matches`;
}
