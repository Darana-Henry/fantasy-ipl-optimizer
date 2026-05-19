export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export function isTodayOrFuture(rawDate) {
  if (!rawDate) return false;
  try {
    const d = new Date(rawDate);
    if (isNaN(d)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d >= today;
  } catch (e) { return false; }
}

export function posAbbr(pos) {
  const map = {
    'BATSMAN': 'BAT', 'BOWLER': 'BOWL',
    'ALL ROUNDER': 'AR', 'ALL-ROUNDER': 'AR', 'WICKET KEEPER': 'WK',
  };
  return map[(pos || '').toUpperCase()] || (pos || '').substring(0, 4).toUpperCase();
}

export function posLabel(pos) {
  const map = { 'WICKET KEEPER': 'WK', 'BATSMAN': 'BAT', 'ALL ROUNDER': 'AR', 'BOWLER': 'BOWL' };
  return map[pos] || (pos || '').substring(0, 3);
}

export function rankClass(r) {
  return r === 1 ? 'rank-1' : r === 2 ? 'rank-2' : r === 3 ? 'rank-3' : 'rank-other';
}

export function momentumArrow(m) {
  if (m >  2) return '<span style="color:#4ade80">▲</span>';
  if (m < -2) return '<span style="color:#f87171">▼</span>';
  return '<span style="color:#94a3b8">━</span>';
}

export function ngBadge(n) {
  if (n === 0 || n === '0') return '<span class="tp-days-badge days-0">Today ✅</span>';
  if (n === 1 || n === '1') return '<span class="tp-days-badge days-1">Next game</span>';
  if (n === 2 || n === '2') return '<span class="tp-days-badge days-2">+2 games</span>';
  if (n === 3 || n === '3') return '<span class="tp-days-badge days-3">+3 games</span>';
  if (n === 4 || n === '4') return '<span class="tp-days-badge days-3">+4 games</span>';
  return `<span class="tp-days-badge days-far">+${n} games</span>`;
}

export function daysBadge(d) {
  if (d === 0) return '<span class="tp-days-badge days-0">Today</span>';
  if (d === 1) return '<span class="tp-days-badge days-1">Tomorrow</span>';
  if (d === 2) return '<span class="tp-days-badge days-2">2 days</span>';
  if (d === 3) return '<span class="tp-days-badge days-3">3 days</span>';
  return `<span class="tp-days-badge days-far">${d} days</span>`;
}

export function formatDate(rawDate) {
  try {
    const d = new Date(rawDate);
    if (!isNaN(d)) return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch (e) { /* fall through */ }
  return rawDate || '';
}
