export async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching data`);
  const json = await res.json();
  if (json.error) throw new Error('Apps Script: ' + json.error);
  return json.rows;
}

function splitRow(row) {
  const res = [];
  let cur = '';
  let inQ = false;
  for (const c of row) {
    if (c === '"')           { inQ = !inQ; }
    else if (c === ',' && !inQ) { res.push(cur); cur = ''; }
    else                     { cur += c; }
  }
  res.push(cur);
  return res;
}

export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = splitRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitRow(line);
    const obj  = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

export async function fetchCSV(url) {
  const res = await fetch(url + '&cachebust=' + Date.now());
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching CSV`);
  return parseCSV(await res.text());
}
