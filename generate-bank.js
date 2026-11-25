// Pre-generate a unique-solution puzzle bank. Run: node generate-bank.js
const fs = require('fs');
const path = require('path');
const P = require('./puzzle.js');

const TARGET = { flash: 50, easy: 50, medium: 50, hard: 50, expert: 50 };
const BUDGET = { flash: 400, easy: 800, medium: 2000, hard: 2500, expert: 2500 };
const out = { flash: [], easy: [], medium: [], hard: [], expert: [] };
const seen = new Set();

let seed = 20261125;
for (const diff of Object.keys(TARGET)) {
  const t0 = Date.now();
  let attempts = 0;
  while (out[diff].length < TARGET[diff] && attempts < TARGET[diff] * 8) {
    attempts++;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const r = P.generate(diff, P.rngFrom(seed), { budgetMs: BUDGET[diff] });
    if (!r) continue;
    const c = P.fmt(r.puzzle);
    if (seen.has(c)) continue;
    const sc = P.solveCount(r.puzzle, 2);
    if (sc.count !== 1) continue;
    const g = P.gradeDifficulty(r.puzzle);
    if (g.level !== diff) continue;
    seen.add(c);
    out[diff].push(c + P.fmt(r.solution));
  }
  console.log(diff + ':', out[diff].length, 'in', Date.now() - t0, 'ms, attempts', attempts);
}

const body = 'var ST_BANK = ' + JSON.stringify(out) + ';\n' +
  'if (typeof module !== "undefined" && module.exports) module.exports = ST_BANK;\n' +
  'if (typeof window !== "undefined") window.ST_BANK = ST_BANK;\n';
fs.writeFileSync(path.join(__dirname, 'puzzles.js'), body);
console.log('wrote puzzles.js', Math.round(body.length / 1024), 'KB');
