import { num } from './utils.js';
import { ALL_MDS } from './config.js';

export function detectPlayedMDs(players) {
  return ALL_MDS.filter(md => players.filter(p => num(p[md]) > 0).length > 10);
}

// Composite Score = Weighted Recency Avg × (1 − Consistency Penalty + Momentum Bonus)
export function compositeScore(scores) {
  if (!scores || scores.length === 0) return { score: 0, wAvg: 0, penalty: 0, momentum: 0 };
  const recent = scores.length >= 4 ? scores.slice(-4) : scores;

  // Weighted recency average — oldest=weight 1, newest=weight n
  const weights = recent.map((_, i) => i + 1);
  const wTotal  = weights.reduce((a, b) => a + b, 0);
  const wAvg    = recent.reduce((s, v, i) => s + v * weights[i], 0) / wTotal;

  // Consistency penalty — coefficient of variation, capped at 15%
  let penalty = 0;
  if (recent.length > 1) {
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const std  = Math.sqrt(recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length);
    const cv   = mean > 0 ? std / mean : 0;
    penalty    = Math.min(cv * 0.15, 0.15);
  }

  // Momentum bonus — linear trend over last 4, capped at ±10%
  let momentum = 0;
  if (recent.length >= 2) {
    const n     = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((a, b) => a + b, 0) / n;
    const numV  = recent.reduce((s, y, i) => s + (i - xMean) * (y - yMean), 0);
    const den   = recent.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
    const slope = den !== 0 ? numV / den : 0;
    momentum    = Math.max(-0.10, Math.min(0.10, slope / (yMean + 1e-9) * 0.10));
  }

  const score = wAvg * (1 - penalty + momentum);
  return {
    score:    Math.round(score * 10) / 10,
    wAvg:     Math.round(wAvg * 10) / 10,
    penalty:  Math.round(penalty * 1000) / 10,
    momentum: Math.round(momentum * 1000) / 10,
  };
}

export function buildPlayer(row, playedMDs) {
  const played    = num(row['Played']);
  const total     = num(row['Total']);
  const last4     = num(row['Last 4']);
  const allScores  = playedMDs.map(md => num(row[md])).filter(v => v > 0);
  const last4MDs   = playedMDs.slice(-4);
  const last4Games = last4MDs.filter(md => num(row[md]) > 0).length;
  const recent     = last4MDs.map(md => num(row[md])).filter(v => v > 0);
  const comp       = compositeScore(allScores);

  return {
    name:         row['Player']   || '',
    team:         row['Team']     || '',
    position:     row['Position'] || '',
    price:        num(row['Price']),
    status:       row['Status']   || '',
    played,
    total,
    avg:          played > 0 ? +(total / played).toFixed(1) : 0,
    last4,
    last4Games,
    last4Avg:     last4Games > 0 ? +(last4 / last4Games).toFixed(1) : 0,
    floor:        recent.length > 0 ? Math.min(...recent) : 0,
    composite:    comp.score,
    wAvg:         comp.wAvg,
    penalty:      comp.penalty,
    momentum:     comp.momentum,
    recentScores: recent,
  };
}
