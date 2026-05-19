import { TEAM_MAP, PAST_FIXTURES } from './config.js';
import { isTodayOrFuture, posAbbr, rankClass, formatDate } from './utils.js';

function buildTeamSchedule() {
  const sched = {};
  for (const [, home, away] of [...PAST_FIXTURES].sort((a, b) => a[0] - b[0])) {
    if (!sched[home]) sched[home] = [];
    if (!sched[away]) sched[away] = [];
    sched[home].push(away);
    sched[away].push(home);
  }
  return sched;
}

export function buildOpponentWeakness(players, playedMDs) {
  const sched    = buildTeamSchedule();
  const conceded = {};

  for (const p of players) {
    const teamSched = sched[p.team] || [];
    let gi = 0;
    for (const md of playedMDs) {
      const score = p._raw ? parseFloat(p._raw[md]) || 0 : 0;
      if (score > 0) {
        const opp = teamSched[gi];
        if (opp) { if (!conceded[opp]) conceded[opp] = []; conceded[opp].push(score); }
        gi++;
      }
    }
  }

  const weakness = {};
  for (const [t, sc] of Object.entries(conceded))
    weakness[t] = Math.round(sc.reduce((a, b) => a + b, 0) / sc.length * 10) / 10;

  const vals = Object.values(weakness);
  const wMin = Math.min(...vals);
  const wMax = Math.max(...vals);
  const norm = {};
  for (const [t, v] of Object.entries(weakness))
    norm[t] = wMax > wMin ? (v - wMin) / (wMax - wMin) : 0.5;

  return { raw: weakness, norm };
}

export function tcScore(player, opponent, oppWeakness) {
  const oppNorm    = oppWeakness.norm[opponent] ?? 0.5;
  const oppBonus   = oppNorm * 0.20;
  const floorRatio = player.wAvg > 0 ? player.floor / player.wAvg : 0;
  const floorPen   = floorRatio < 0.30 ? 0.15 : floorRatio < 0.50 ? 0.07 : 0;
  return Math.round(player.composite * (1 + oppBonus - floorPen) * 10) / 10;
}

function buildTCReason(player, opponent, oppWeakness) {
  const parts    = [];
  const oppRaw   = oppWeakness.raw[opponent] ?? 40;
  const oppRanks = Object.entries(oppWeakness.raw).sort((a, b) => b[1] - a[1]);
  const oppPos   = oppRanks.findIndex(([t]) => t === opponent) + 1;
  const ordinals = ['weakest', '2nd weakest', '3rd weakest'];

  if (oppPos <= 3) parts.push(`${opponent} has the ${ordinals[oppPos - 1]} defence in the tournament (avg ${oppRaw} pts conceded per player per game)`);
  if (player.momentum >  3) parts.push(`Strong upward form — momentum is +${player.momentum}%, scoring is trending up`);
  if (player.momentum < -3) parts.push(`⚠️ Downward trend — momentum is ${player.momentum}%, recent scores are falling`);
  if (player.penalty  <  5) parts.push(`Highly consistent performer — only ${player.penalty}% variance between games`);
  if (player.penalty  > 10) parts.push(`⚠️ Volatile scorer — ${player.penalty}% variance means their output is unpredictable`);
  if (player.wAvg     > 80) parts.push(`Elite form — weighted average of ${player.wAvg} pts/game (recency-weighted)`);

  const floorRatio = player.wAvg > 0 ? player.floor / player.wAvg : 0;
  if (floorRatio > 0.6) parts.push(`Safe floor — worst recent game was ${player.floor} pts, which is ${Math.round(floorRatio * 100)}% of their weighted average`);
  if (floorRatio < 0.3) parts.push(`⚠️ Floor risk — worst recent game was only ${player.floor} pts vs a ${player.wAvg} weighted avg`);
  if (player.played < 3) parts.push(`⚠️ Thin data — only ${player.played} game(s) played so far. Treat with caution`);

  return parts.length ? parts : [`Solid composite score of ${player.composite} against ${opponent}`];
}

export function buildTCRankings(players, fixtures, oppWeakness) {
  const upcoming = fixtures
    .filter(fix => {
      const match = fix['Match'] || '';
      return match && !match.includes('TBD') && isTodayOrFuture(fix['Date']);
    })
    .sort((a, b) => new Date(a['Date']) - new Date(b['Date']))
    .slice(0, 10);

  const fixtureGroups = [];

  for (const fix of upcoming) {
    const md    = parseInt(fix['#']);
    const match = fix['Match'] || '';
    const teams = Object.entries(TEAM_MAP).filter(([f]) => match.includes(f)).map(([, c]) => c);
    if (teams.length < 2) continue;

    const dateStr = formatDate(fix['Date']);

    const candidates = [];
    for (const p of players) {
      if (!teams.includes(p.team) || p.total <= 0 || p.composite <= 0) continue;
      if ((p.last4Games || 0) < 3) continue;
      const opponent = teams.find(t => t !== p.team);
      if (!opponent) continue;
      const tc      = tcScore(p, opponent, oppWeakness);
      const reasons = buildTCReason(p, opponent, oppWeakness);
      candidates.push({ md, date: dateStr, match, player: p, opponent, tc, reasons,
        oppWeakRaw: oppWeakness.raw[opponent] ?? 40 });
    }

    const top3 = candidates.sort((a, b) => b.tc - a.tc).slice(0, 3);
    if (top3.length) fixtureGroups.push({ md, date: dateStr, match, top3 });
  }

  return fixtureGroups;
}

function scoreBubbleClass(s, avg) {
  return s >= avg * 0.8 ? 'high' : s >= avg * 0.4 ? 'mid' : 'low';
}

function buildTCCard(item, rank) {
  const p        = item.player;
  const id       = 'tc-' + rank + '-' + Math.random().toString(36).slice(2, 5);
  const search   = [p.name, p.team, item.match, item.date, item.opponent].join(' ').toLowerCase();
  const rkCls    = rankClass(rank);
  const cardBorder = rank <= 3 ? `rank-${rank}-card` : '';
  const floorRatio = p.wAvg > 0 ? p.floor / p.wAvg : 0;

  const bubbles = (p.recentScores || []).map((s, i, arr) => {
    const cls   = scoreBubbleClass(s, p.wAvg);
    const arrow = i < arr.length - 1 ? `<span class="score-arrow"> › </span>` : '';
    return `<div class="score-bubble ${cls}">${s}</div>${arrow}`;
  }).join('');

  const reasonHTML = item.reasons.map(r => {
    const warn = r.startsWith('⚠️');
    return `<div class="tc-reason" style="${warn ? 'border-left-color:#f87171;color:#fca5a5;background:rgba(248,113,113,0.07)' : ''}">${r}</div>`;
  }).join('');

  const pills = [];
  if (p.penalty  <  5) pills.push('<span class="tc-pill pill-green">✓ Consistent</span>');
  if (p.penalty  > 10) pills.push('<span class="tc-pill pill-red">⚠ Volatile</span>');
  if (p.momentum >  3) pills.push('<span class="tc-pill pill-green">↑ In Form</span>');
  if (p.momentum < -3) pills.push('<span class="tc-pill pill-red">↓ Fading</span>');
  if (floorRatio > 0.6) pills.push('<span class="tc-pill pill-green">✓ Safe Floor</span>');
  if (floorRatio < 0.3) pills.push('<span class="tc-pill pill-red">⚠ Floor Risk</span>');
  if (p.played < 3)    pills.push('<span class="tc-pill pill-yellow">⚠ Thin Data</span>');
  pills.push(`<span class="tc-pill pill-purple">${posAbbr(p.position)}</span>`);
  pills.push(`<span class="tc-pill pill-blue">vs ${item.opponent}</span>`);

  return `
  <div class="tc-card ${cardBorder}" id="${id}" data-search="${search}">
    <div class="tc-header">
      <div class="rank-circle ${rkCls}">#${rank}</div>
      <div class="tc-player-block">
        <div class="tc-player-name">${p.name}</div>
        <div class="tc-player-meta">
          <span class="team-tag tag-${p.team}">${p.team}</span>
          <span class="pos-tag">${posAbbr(p.position)}</span>
          <span style="font-size:0.78rem;color:var(--text-secondary)">₹${p.price}Cr</span>
          <span style="font-size:0.78rem;color:var(--text-secondary)">${p.status}</span>
        </div>
        <div class="tc-match-line">📅 MD #${item.md} · ${item.date} &nbsp;·&nbsp; ${item.match}</div>
      </div>
      <div class="tc-score-block">
        <div class="tc-score-num">${item.tc}</div>
        <div class="tc-score-lbl">👑 TC Score</div>
      </div>
    </div>
    <div class="tc-body">
      ${reasonHTML}
      <div class="tc-risk-bar">${pills.join('')}</div>
      <div class="tc-stats-grid" style="margin-top:14px">
        <div class="tc-stat-box"><div class="tc-stat-label">⚡ Composite</div><div class="tc-stat-value" style="color:#c084fc">${p.composite}</div><div class="tc-stat-sub">Overall form score</div></div>
        <div class="tc-stat-box"><div class="tc-stat-label">📊 Weighted Avg</div><div class="tc-stat-value" style="color:var(--ipl-sky)">${p.wAvg}</div><div class="tc-stat-sub">Recency-weighted pts/game</div></div>
        <div class="tc-stat-box"><div class="tc-stat-label">🏏 Total Pts</div><div class="tc-stat-value" style="color:var(--ipl-sky)">${p.total}</div><div class="tc-stat-sub">${p.played} games · avg ${p.avg}/game</div></div>
        <div class="tc-stat-box"><div class="tc-stat-label">🔥 Last 4 Pts</div><div class="tc-stat-value" style="color:var(--ipl-gold)">${p.last4}</div><div class="tc-stat-sub">${p.last4Games} games · avg ${p.last4Avg}/game</div></div>
        <div class="tc-stat-box"><div class="tc-stat-label">🛡 Opp Defence</div><div class="tc-stat-value" style="color:#fb923c">${item.oppWeakRaw}</div><div class="tc-stat-sub">Avg pts conceded vs ${item.opponent}</div></div>
        <div class="tc-stat-box"><div class="tc-stat-label">📉 Floor</div><div class="tc-stat-value" style="color:${floorRatio > 0.5 ? '#4ade80' : '#f87171'}">${p.floor}</div><div class="tc-stat-sub">Worst of last ${p.recentScores?.length || 0} games</div></div>
      </div>
      <div class="recent-scores">
        <span class="recent-label">Recent:</span>
        ${bubbles || '<span style="color:var(--text-secondary);font-size:0.82rem">No data</span>'}
        <span style="font-size:0.75rem;color:var(--text-secondary);margin-left:6px">(oldest → newest)</span>
      </div>
    </div>
  </div>`;
}

function buildFixtureHeader(group) {
  return `
  <div class="fixture-group-header">
    <div class="fixture-group-badge">MD #${group.md}</div>
    <div class="fixture-group-name">${group.match}</div>
    <div class="fixture-group-date">📅 ${group.date}</div>
  </div>`;
}

export function renderTCRankings(fixtureGroups) {
  const container = document.getElementById('cards-captain');

  if (!fixtureGroups.length) {
    container.innerHTML = '<div class="empty"><div class="icon">📅</div><div>No upcoming fixtures found</div></div>';
    document.getElementById('count-captain').textContent = '0 fixtures';
    return;
  }

  let html = '';
  fixtureGroups.forEach(group => {
    html += buildFixtureHeader(group);
    group.top3.forEach((item, i) => { html += buildTCCard(item, i + 1); });
  });

  container.innerHTML = html;
  const allCards = container.querySelectorAll('.tc-card');
  document.getElementById('count-captain').textContent = `${allCards.length} picks across ${fixtureGroups.length} fixtures`;

  document.getElementById('info-captain').innerHTML = `
    <div class="info-chip">👑 Top 3 captain picks for each of the next <strong>${fixtureGroups.length}</strong> fixtures</div>
    <div class="info-chip">🧮 TC Score = Composite × (1 + Opp Weakness − Floor Risk)</div>
    <div class="info-chip">✅ Players must have played ≥ 3 of last 4 games</div>
    <div class="info-chip">🛡 Opponent weakness derived from ${PAST_FIXTURES.length} past matchups</div>`;
}

export function filterTCCards() {
  const q     = document.getElementById('search-captain').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#cards-captain .tc-card');
  let vis = 0;
  cards.forEach(c => {
    const show = !q || c.getAttribute('data-search').includes(q);
    c.style.display = show ? '' : 'none';
    if (show) vis++;
  });
  document.getElementById('count-captain').textContent =
    vis < cards.length ? `Showing ${vis} of ${cards.length}` : `${cards.length} picks`;

  const container = document.getElementById('cards-captain');
  const empty = container.querySelector('.empty');
  if (vis === 0 && q) {
    if (!empty) container.insertAdjacentHTML('beforeend',
      `<div class="empty"><div class="icon">🔍</div><div>No matches for "<strong>${q}</strong>"</div></div>`);
  } else if (empty) {
    empty.remove();
  }
}
