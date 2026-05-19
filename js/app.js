import { PLAYERS_URL, FIXTURES_URL, TEAM_URL } from './config.js';
import { fetchSheet } from './data.js';
import { detectPlayedMDs, buildPlayer } from './scoring.js';
import { rankFixtures, renderRankings, filterCards } from './rankings.js';
import { buildOpponentWeakness, buildTCRankings, renderTCRankings, filterTCCards } from './captain.js';
import { buildForeignRoyaleData, buildIndianRoyaleData, renderForeignRoyale, renderIndianRoyale, filterHistory, filterIndianRoyale } from './royale.js';
import { renderTransferPlanner } from './transfer.js';

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('pane-' + tab).classList.add('active');
  btn.classList.add('active');
}

async function loadData() {
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('error-screen').style.display   = 'none';
  document.getElementById('app').style.display            = 'none';
  document.getElementById('last-updated-bar').textContent = 'Fetching latest data from Google Sheets…';

  try {
    const [rawPlayers, rawFixtures, rawTeam] = await Promise.all([
      fetchSheet(PLAYERS_URL),
      fetchSheet(FIXTURES_URL),
      fetchSheet(TEAM_URL),
    ]);

    if (!rawPlayers.length)  throw new Error('PlayerData tab appears empty.');
    if (!rawFixtures.length) throw new Error('FixtureList tab appears empty.');

    const playedMDs = detectPlayedMDs(rawPlayers);
    const last4MDs  = playedMDs.slice(-4);
    if (!playedMDs.length) throw new Error('No match day data found.');

    const players = rawPlayers
      .filter(r => r['Player'] && String(r['Player']).trim())
      .map(r => { const p = buildPlayer(r, playedMDs); p._raw = r; return p; });

    const foreignRankings = rankFixtures(players, rawFixtures, 'Foreign', 4);
    const indianRankings  = rankFixtures(players, rawFixtures, 'Indian',  11);
    const oppWeakness     = buildOpponentWeakness(players, playedMDs);
    const captainRankings = buildTCRankings(players, rawFixtures, oppWeakness);

    renderRankings('foreign', foreignRankings, last4MDs);
    renderRankings('indian',  indianRankings,  last4MDs);
    renderTCRankings(captainRankings);

    const isValidTeamSheet = renderTransferPlanner(rawTeam, players, rawFixtures, playedMDs);

    renderForeignRoyale(buildForeignRoyaleData(players, playedMDs, rawFixtures));
    renderIndianRoyale(buildIndianRoyaleData(players, playedMDs, rawFixtures));

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').style.display            = '';

    const squadCount = isValidTeamSheet
      ? rawTeam.filter(r => {
          const name = String(r['Player'] || '').trim();
          return name && !name.toLowerCase().includes('price') &&
                 !name.toLowerCase().includes('remain') &&
                 !name.toLowerCase().includes('transfer');
        }).length
      : null;
    const teamStatus = squadCount !== null
      ? `· 👕 ${squadCount} players in squad`
      : '· ⚠️ CurrentTeam sheet not loaded';

    document.getElementById('last-updated-bar').innerHTML =
      `✅ Last updated: <strong>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong> IST
       &nbsp;·&nbsp; ${players.length} players · ${rawFixtures.length} fixtures · ${playedMDs.length} MDs played ${teamStatus}
       <button id="refresh-btn">↻ Refresh</button>`;

  } catch (err) {
    console.error(err);
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('error-screen').style.display   = 'flex';
    document.getElementById('error-msg-text').textContent   =
      err.message + '\n\nCheck that the Apps Script is deployed as a Web App with "Anyone" access, and sheet names are exactly "PlayerData" and "FixtureList".';
    document.getElementById('error-url-text').textContent   = 'Apps Script URL: ' + PLAYERS_URL;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab, btn));
  });

  // Search inputs
  document.getElementById('search-foreign').addEventListener('input',      () => filterCards('foreign'));
  document.getElementById('search-indian').addEventListener('input',       () => filterCards('indian'));
  document.getElementById('search-captain').addEventListener('input',      () => filterTCCards());
  document.getElementById('search-history').addEventListener('input',      () => filterHistory());
  document.getElementById('search-indianroyale').addEventListener('input', () => filterIndianRoyale());

  // Refresh buttons (delegated — the success-path innerHTML also renders #refresh-btn)
  document.addEventListener('click', e => {
    if (e.target.id === 'refresh-btn' || e.target.id === 'refresh-btn-2') loadData();
  });

  loadData();
});
