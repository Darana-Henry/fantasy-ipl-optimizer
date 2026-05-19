import { TP_STATIC } from './config.js';
import { ngBadge, posLabel } from './utils.js';

function urgFromNextGame(ng) {
  const n = parseInt(ng);
  if (isNaN(n)) return 0.3;
  return { 0: 1.3, 1: 1.1, 2: 1.0, 3: 0.85, 4: 0.7 }[n] ?? 0.5;
}

function esFromSheet(composite, nextGame) {
  return Math.round(composite * urgFromNextGame(nextGame) * 100) / 100;
}

function parseCurrentTeam(rawTeamRows, playerPool) {
  return rawTeamRows
    .filter(r => {
      const name = String(r['Player'] || '').trim();
      return name &&
        !name.toLowerCase().includes('price') &&
        !name.toLowerCase().includes('remain') &&
        !name.toLowerCase().includes('transfer');
    })
    .map(r => {
      const name     = String(r['Player']).trim();
      const team     = String(r['Team']     || '').trim();
      const position = String(r['Position'] || '').trim();
      const status   = String(r['Type'] || r['Status'] || '').trim();
      const price    = parseFloat(r['Price']) || 0;
      const nextGame = parseInt(r['Next Game'] ?? r['Next Gam'] ?? 99);

      const poolP      = playerPool.find(p => p.name === name);
      const composite  = poolP ? poolP.composite  : 0;
      const wAvg       = poolP ? poolP.wAvg        : 0;
      const last4      = poolP ? poolP.last4        : 0;
      const last4Games = poolP ? poolP.last4Games   : 0;
      const total      = poolP ? poolP.total        : 0;
      const avg        = poolP ? poolP.avg          : 0;
      const next_match = poolP ? poolP.next_match   : '';
      const es         = esFromSheet(composite, nextGame);

      return { name, team, position, status, price, nextGame, composite, wAvg,
               last4, last4Games, total, avg, next_match, es };
    });
}

function buildLiveTransferPlans(currentTeam, playerPool) {
  const currentNames = new Set(currentTeam.map(p => p.name));
  const plans = {};

  const sorted = [...currentTeam].sort((a, b) => {
    const ngDiff = (b.nextGame || 0) - (a.nextGame || 0);
    if (ngDiff !== 0) return ngDiff;
    return (a.composite || 0) - (b.composite || 0);
  });

  for (let n = 1; n <= 5; n++) {
    const toRemove     = sorted.slice(0, n);
    const removeNames  = new Set(toRemove.map(p => p.name));
    const removedPrice = toRemove.reduce((s, p) => s + (p.price || 0), 0);
    const plan         = [];
    const chosenNames  = new Set();
    const chosenPrices = [];

    for (const outP of toRemove) {
      const spent       = chosenPrices.reduce((a, b) => a + b, 0);
      const budgetFreed = removedPrice - spent;

      const currentAfter = [
        ...currentTeam.filter(p => !removeNames.has(p.name)),
        ...playerPool.filter(p => chosenNames.has(p.name)),
      ];
      const remainingNames = new Set(currentAfter.map(p => p.name));
      const foreignCt = currentAfter.filter(p =>
        (p.status || '').toLowerCase().includes('foreign') ||
        (p.status || '').toLowerCase().includes('overseas')
      ).length;
      const teamCt = {};
      currentAfter.forEach(p => { teamCt[p.team] = (teamCt[p.team] || 0) + 1; });

      const isOutForeign = (outP.status || '').toLowerCase().includes('foreign') ||
                           (outP.status || '').toLowerCase().includes('overseas');

      const cands = playerPool.filter(p => {
        if (remainingNames.has(p.name))                              return false;
        if (currentNames.has(p.name) && !removeNames.has(p.name))   return false;
        if (p.position !== outP.position)                            return false;
        if ((p.price || 0) > budgetFreed)                            return false;
        if (p.days_away !== 0)                                       return false;
        if ((p.last4Games || 0) < 2)                                 return false;
        const isCandForeign = (p.status || '').toLowerCase().includes('foreign') ||
                              (p.status || '').toLowerCase().includes('overseas');
        if (isCandForeign && !isOutForeign && foreignCt >= 4)        return false;
        if (isCandForeign && isOutForeign  && foreignCt > 4)         return false;
        if ((teamCt[p.team] || 0) >= 7)                              return false;
        return true;
      }).sort((a, b) => (b.composite || 0) - (a.composite || 0));

      const top3   = cands.slice(0, 3).map(p => ({ ...p, es: esFromSheet(p.composite, p.days_away === 0 ? 0 : 99) }));
      const chosen = top3[0];
      chosenNames.add(chosen?.name || '__none__');
      chosenPrices.push(chosen?.price || 0);

      plan.push({
        out:          { ...outP },
        options:      top3,
        budget_after: Math.round((budgetFreed - (chosen?.price || 0)) * 100) / 100,
      });
    }
    plans[String(n)] = plan;
  }
  return plans;
}

function tpPlayerCard(p) {
  const esColor = '#4ade80';
  return `
  <div class="tp-player-card in-card">
    <span class="team-dot team-${p.team}"></span>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:0.92rem">${p.name}</span>
        <span class="team-tag tag-${p.team}">${p.team}</span>
        <span class="tp-pos-badge">${posLabel(p.position)}</span>
        <span style="font-size:0.72rem;color:var(--text-secondary)">${p.status}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap">
        ${ngBadge(p.nextGame ?? p.days_away ?? 99)}
        <span>⚡ ${p.composite}</span>
        <span>🔥 L4: ${p.last4}</span>
        <span>💰 ₹${p.price}Cr</span>
        <span style="font-size:0.7rem;color:var(--text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.next_match}">${p.next_match}</span>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:1rem;font-weight:800;color:${esColor}">${p.es}</div>
      <div style="font-size:0.65rem;color:var(--text-secondary)">ES</div>
    </div>
  </div>`;
}

function tpOutCard(p) {
  return `
  <div class="tp-player-card out-card">
    <span class="team-dot team-${p.team}"></span>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:0.92rem">${p.name}</span>
        <span class="team-tag tag-${p.team}">${p.team}</span>
        <span class="tp-pos-badge">${posLabel(p.position)}</span>
        <span style="font-size:0.72rem;color:var(--text-secondary)">${p.status}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:3px;display:flex;gap:8px;flex-wrap:wrap">
        ${ngBadge(p.nextGame ?? p.days_away ?? 99)}
        <span>⚡ ${p.composite}</span>
        <span>🔥 L4: ${p.last4}</span>
        <span>💰 ₹${p.price}Cr</span>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:1rem;font-weight:800;color:#f87171">${p.es}</div>
      <div style="font-size:0.65rem;color:var(--text-secondary)">ES</div>
    </div>
  </div>`;
}

function buildTransferReason(out, inp) {
  const outReasons = [];
  const outNG = out.nextGame ?? out.days_away ?? 99;
  if (outNG >= 4) outReasons.push(`${out.team} don't play for another ${outNG} game cycles — dead weight for the current game`);
  else if (outNG >= 2) outReasons.push(`${out.team} play ${outNG} game cycles away — not useful right now`);
  if (out.composite < 30) outReasons.push(`Very low form (composite score: ${out.composite})`);
  if (out.last4 < 100)    outReasons.push(`Poor recent output — only ${out.last4} pts in last 4 games`);

  const inReasons = [];
  if (inp) {
    if ((inp.nextGame ?? inp.days_away ?? 99) === 0) inReasons.push(`Playing in the current game — immediate points`);
    if (inp.composite > 70)     inReasons.push(`Strong form: composite score ${inp.composite}`);
    if (inp.price < out.price)  inReasons.push(`Saves ₹${(out.price - inp.price).toFixed(1)}Cr for future transfers`);
    if (inp.price === out.price) inReasons.push(`Same price — no budget impact`);
  }

  return {
    outReason: outReasons.length ? outReasons[0] : `ES score: ${out.es}`,
    inReason:  inReasons.length  ? inReasons[0]  : inp ? `ES score: ${inp.es}` : '',
  };
}

function buildTransferStep(step, stepNum) {
  const out    = step.out;
  const opts   = step.options;
  const best   = opts[0];
  const alts   = opts.slice(1);
  const reason = buildTransferReason(out, best);

  return `
  <div class="tp-step">
    <div class="tp-step-header">
      <div class="tp-step-num">${stepNum}</div>
      <div class="tp-step-title">Transfer ${stepNum}</div>
      <div class="tp-step-budget">Budget after: ₹${step.budget_after}Cr</div>
    </div>
    <div class="tp-out-in">
      <div class="tp-out">
        <div class="tp-out-label">⬇ Remove</div>
        ${tpOutCard(out)}
        <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:4px;padding:4px 8px;background:rgba(248,113,113,0.07);border-radius:6px">${reason.outReason}</div>
      </div>
      <div class="tp-in">
        <div class="tp-in-label">⬆ Best pick</div>
        ${best
          ? tpPlayerCard(best) + `<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:4px;padding:4px 8px;background:rgba(74,222,128,0.07);border-radius:6px">${reason.inReason}</div>`
          : '<div style="color:#fb923c;font-size:0.82rem;padding:10px;background:rgba(251,146,60,0.08);border-radius:6px;border:1px solid rgba(251,146,60,0.2)">⚠️ No eligible player available today at this position within budget. Try combining with another transfer to free more budget.</div>'
        }
        ${alts.length ? `<div class="tp-alt-label">Also consider:</div>${alts.map(tpPlayerCard).join('')}` : ''}
      </div>
    </div>
  </div>`;
}

function buildCurrentTeamTable(team) {
  const sorted = [...team].sort((a, b) => {
    const ng = (b.nextGame ?? b.days_away ?? 99) - (a.nextGame ?? a.days_away ?? 99);
    if (ng !== 0) return ng;
    return (a.composite || 0) - (b.composite || 0);
  });

  const rows = sorted.map(p => {
    const ng2     = p.nextGame ?? p.days_away ?? 99;
    const urgColor = ng2 <= 1 ? '#4ade80' : ng2 <= 2 ? '#facc15' : ng2 <= 3 ? '#fb923c' : '#f87171';
    return `
    <div class="tp-player-row">
      <span class="team-dot team-${p.team}"></span>
      <div class="tp-player-info">
        <div class="tp-player-name">${p.name}</div>
        <div class="tp-player-meta">
          <span class="team-tag tag-${p.team}" style="font-size:0.65rem">${p.team}</span>
          <span class="tp-pos-badge">${posLabel(p.position)}</span>
          <span>${p.status}</span>
          <span>₹${p.price}Cr</span>
        </div>
      </div>
      ${ngBadge(ng2)}
      <div class="tp-score-col">
        <div class="tp-score-val" style="color:${urgColor}">${p.es}</div>
        <div class="tp-score-sub">Eff. Score</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="tp-card">
    <div class="tp-card-header">
      <div>
        <div class="tp-card-title">📋 Your Squad</div>
        <div class="tp-card-sub">Sorted by urgency to transfer out (worst first)</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1rem;font-weight:700;color:var(--ipl-gold)">₹100Cr</div>
        <div style="font-size:0.72rem;color:var(--text-secondary)">Budget used</div>
      </div>
    </div>
    ${rows}
  </div>`;
}

function buildKeyStats(team, transfersLeft) {
  const tl            = transfersLeft ?? TP_STATIC.transfersLeft ?? 70;
  const playing_today = team.filter(p => (p.days_away ?? p.nextGame) === 0).length;
  const tomorrow      = team.filter(p => (p.days_away ?? p.nextGame) === 1).length;
  const far           = team.filter(p => (p.days_away ?? p.nextGame) >= 4).length;
  const foreign       = team.filter(p => (p.status || '').toLowerCase().includes('foreign')).length;

  return `
  <div class="tp-summary-bar">
    <div class="tp-summary-chip" style="background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3)">✅ ${playing_today} playing today</div>
    <div class="tp-summary-chip" style="background:rgba(163,230,53,0.15);color:#a3e635;border:1px solid rgba(163,230,53,0.3)">📅 ${tomorrow} playing tomorrow</div>
    <div class="tp-summary-chip" style="background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.3)">⚠️ ${far} sitting out 4+ days</div>
    <div class="tp-summary-chip" style="background:rgba(79,145,205,0.15);color:var(--ipl-sky);border:1px solid rgba(79,145,205,0.3)">🌍 ${foreign}/4 foreign slots used</div>
    <div class="tp-summary-chip" style="background:rgba(245,166,35,0.15);color:var(--ipl-gold);border:1px solid rgba(245,166,35,0.3)">🔄 ${tl} transfers left</div>
  </div>`;
}

let livePlans   = null;
let currentTPn  = 1;

function renderTPPlan(n) {
  const plan = (livePlans || TP_STATIC.transferPlans)[String(n)] || [];
  const area = document.getElementById('tp-plan-area');
  if (!area) return;
  if (!plan.length) {
    area.innerHTML = '<div class="empty"><div class="icon">🔄</div><div>No plan available</div></div>';
    return;
  }
  area.innerHTML = `<div class="tp-plan-container">${plan.map((step, i) => buildTransferStep(step, i + 1)).join('')}</div>`;
}

export function renderTransferPlanner(rawTeamRows, playerPool, rawFixtures, playedMDs) {
  const isValidTeamSheet = rawTeamRows && rawTeamRows.length &&
    rawTeamRows.some(r => 'Next Game' in r || 'Next Gam' in r || 'NextGame' in r);

  let team;
  if (isValidTeamSheet && playerPool) {
    team      = parseCurrentTeam(rawTeamRows, playerPool);
    livePlans = buildLiveTransferPlans(team, playerPool);
  } else {
    team      = TP_STATIC.currentTeam;
    livePlans = TP_STATIC.transferPlans;
  }

  const transfersLeft = TP_STATIC.transfersLeft ?? 70;
  const app = document.getElementById('tp-app');
  if (!app) return isValidTeamSheet;

  app.innerHTML = `
  <div style="padding:20px 0">
    <div class="info-bar">
      <div class="info-chip">🔄 <strong>${transfersLeft}</strong> transfers left</div>
      <div class="info-chip">⚡ Effective Score = Composite × Urgency (today=1.3×, tomorrow=1.1×, 4+ days=0.7×)</div>
      <div class="info-chip">📅 Transfers in: <strong>today's game only</strong> · min <strong>2 of last 4 games</strong> played</div>
    </div>
    ${buildKeyStats(team, transfersLeft)}
    <div class="tp-grid">
      ${buildCurrentTeamTable(team)}
      <div>
        <div class="tp-section-title" style="margin-bottom:10px">Select number of transfers</div>
        <div class="tp-n-selector" id="tp-n-selector">
          ${[1, 2, 3, 4, 5].map(n => `<button class="tp-n-btn${n === currentTPn ? ' active' : ''}" data-n="${n}">${n} Transfer${n > 1 ? 's' : ''}</button>`).join('')}
        </div>
        <div id="tp-plan-area"></div>
      </div>
    </div>
  </div>`;

  // N-selector event delegation
  document.getElementById('tp-n-selector').addEventListener('click', e => {
    const btn = e.target.closest('.tp-n-btn');
    if (!btn) return;
    const n = parseInt(btn.dataset.n);
    currentTPn = n;
    document.querySelectorAll('.tp-n-btn').forEach((b, i) => b.classList.toggle('active', i + 1 === n));
    renderTPPlan(n);
  });

  renderTPPlan(currentTPn);
  return isValidTeamSheet;
}
