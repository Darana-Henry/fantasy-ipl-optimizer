# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Fantasy IPL dashboard — no build tooling, no package manager, no framework. Pure HTML + CSS + vanilla JS using native ES modules. Open directly in a browser via a static file server (ES modules require HTTP, not `file://`).

## Running locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Project structure

```
index.html          — markup only, links css/styles.css and js/app.js (type="module")
css/
  styles.css        — all CSS (CSS custom properties, no preprocessor)
js/
  config.js         — API URLs, TEAM_MAP, ALL_MDS, PAST_FIXTURES, TP_STATIC fallback
  utils.js          — shared helpers: num(), isTodayOrFuture(), formatDate(), posAbbr(), ngBadge(), etc.
  scoring.js        — detectPlayedMDs(), compositeScore(), buildPlayer()
  data.js           — fetchSheet(), parseCSV(), fetchCSV()
  rankings.js       — Foreign Stars & Indian Warriors tabs: rankFixtures(), renderRankings(), filterCards()
  captain.js        — Triple Captain tab: buildOpponentWeakness(), buildTCRankings(), renderTCRankings(), filterTCCards()
  royale.js         — Foreign & Indian Royale tabs: buildForeignRoyaleData(), buildIndianRoyaleData(), render*, filter*
  transfer.js       — Transfer Planner tab: renderTransferPlanner() (returns isValidTeamSheet boolean)
  app.js            — Entry point: imports all modules, wires event listeners, defines loadData() and switchTab()
```

No inline event handlers anywhere — all events are wired in `app.js` or via event delegation inside each module's render function.

## Data sources

All data is fetched at runtime from Google Sheets via a deployed Google Apps Script Web App:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/...';
const PLAYERS_URL     = APPS_SCRIPT_URL + '?sheet=PlayerData';
const FIXTURES_URL    = APPS_SCRIPT_URL + '?sheet=FixtureList';
const TEAM_URL        = APPS_SCRIPT_URL + '?gid=87107120';  // CurrentTeam sheet
```

The Apps Script must be deployed as a Web App with "Anyone" access. Sheet names must exactly match `PlayerData` and `FixtureList`. `loadData()` in `app.js` fetches all three in parallel.

`PlayerData` columns: `Player`, `Team`, `Position`, `Price`, `Status` (Foreign/Indian), `Played`, `Total`, `Last 4`, and per-match-day columns (`MD 1` … `MD 14`).

`FixtureList` columns: `#` (fixture number), `Match` (full team names), `Date`, `Home Team`, `Away Team`.

`CurrentTeam` columns: `Player`, `Team`, `Position`, `Type`/`Status`, `Price`, `Next Game` (0=today, 1=next cycle, etc.).

## Architecture and data flow

```
loadData() [app.js]
  ├── fetchSheet(PLAYERS_URL) → rawPlayers
  ├── fetchSheet(FIXTURES_URL) → rawFixtures
  └── fetchSheet(TEAM_URL) → rawTeam

  detectPlayedMDs(rawPlayers) → playedMDs   [scoring.js]
  buildPlayer(row, playedMDs) per row        [scoring.js]

  rankFixtures(players, fixtures, 'Foreign', 4)  → renderRankings('foreign', …)  [rankings.js]
  rankFixtures(players, fixtures, 'Indian', 11)  → renderRankings('indian', …)   [rankings.js]
  buildOpponentWeakness(players, playedMDs)      → buildTCRankings(…)            [captain.js]
  renderTransferPlanner(rawTeam, players, …)                                     [transfer.js]
  buildForeignRoyaleData / buildIndianRoyaleData → renderForeignRoyale / renderIndianRoyale  [royale.js]
```

## Scoring algorithms

**Composite Score** (`scoring.js` → `compositeScore(scores)`):
```
Composite = WeightedRecentAvg × (1 − ConsistencyPenalty + MomentumBonus)
```
- Weighted average of last 4 scores: oldest=weight 1, newest=weight n
- Consistency penalty: coefficient of variation, capped at 15%
- Momentum bonus: linear regression slope over last 4, capped at ±10%

`buildPlayer()` returns: `{ name, team, position, price, status, played, total, avg, last4, last4Games, last4Avg, floor, composite, wAvg, penalty, momentum, recentScores }`.
The `floor` field is `Math.min(...recentScores)` — used for Triple Captain floor-risk penalty.

**Triple Captain Score** (`captain.js` → `tcScore(player, opponent, oppWeakness)`):
```
TC Score = Composite × (1 + OpponentWeaknessNorm×0.20 − FloorPenalty)
```
Opponent weakness is derived from average fantasy points conceded per player per game across the `PAST_FIXTURES` hardcoded schedule. `FloorPenalty` is 15% if `floor/wAvg < 0.30`, else 7% if `< 0.50`.

**Effective Score** (`transfer.js`):
```
ES = Composite × Urgency  (nextGame=0 → 1.3×, 1 → 1.1×, 2 → 1.0×, 3 → 0.85×, 4+ → 0.7×)
```

## Tab breakdown

| Tab | Key constraint |
|-----|---------------|
| Foreign Stars | Top 4 foreign players per upcoming fixture, must have played ≥3 of last 4 MDs |
| Indian Warriors | Top 11 Indian players per upcoming fixture, must have played ≥3 of last 4 MDs |
| Triple Captain | Top 3 captain picks for next 10 fixtures, must have played ≥3 of last 4 MDs |
| Foreign Royale | Past fixtures, top 4 foreigners per game, sorted by actual score |
| Indian Royale | Past fixtures, top 11 Indians per game (max 7 from one team) |
| Transfer Planner | 1–5 transfer plans: candidates must play today, ≥2 of last 4 MDs, ≤4 foreign slots, ≤7 per team |

## Transfer Planner details

`renderTransferPlanner()` returns `isValidTeamSheet` (boolean) so `loadData()` can display the correct status message.

The planner has a **static fallback** (`TP_STATIC` in `config.js`) shown when the CurrentTeam sheet is unavailable or lacks a `Next Game` column. To update the static fallback when the sheet is down, replace the `TP_STATIC` constant. Its shape:
```js
{
  currentTeam: [ { name, team, position, status, price, composite, wAvg, penalty, momentum,
                   days_away, next_fix, next_match, next_date, last4, played, avg,
                   last4_games, total, es } ],
  transferPlans: { "1": [...], "2": [...], … "5": [...] },
  transfersLeft: 70
}
```

`buildLiveTransferPlans()` produces plans for 1–5 transfers. It sorts current team by urgency (furthest from playing, then lowest composite) and iterates — each successive transfer in a plan respects the squad state left by prior transfers (foreign slot count, per-team count, remaining budget).
