// Node unit tests for the puzzle engine and the pre-generated bank.
const P = require('../puzzle.js');
const BANK = require('../puzzles.js');

let failed = 0, passed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log('PASS  ' + msg); }
  else { failed++; console.log('FAIL  ' + msg); }
}

const base = P.parse('123456789456789123789123456231564897564897231897231564312645978645978312978312645');
check(P.isValidBoard(base) && P.clueCount(base) === 81, 'seed grid is a valid complete sudoku');
check(P.solveCount(base, 2).count === 1, 'seed grid is unique (already complete)');

const rnd = P.rngFrom(99);
for (let i = 0; i < 8; i++) {
  const b = P.fillComplete(P.rngFrom(100 + i));
  if (!(P.isValidBoard(b) && P.clueCount(b) === 81 && P.solveCount(b, 2).count === 1)) {
    check(false, 'complete board ' + i);
    break;
  }
  if (i === 7) check(true, '8 shuffled complete boards are valid and unique');
}

['flash', 'easy', 'medium', 'hard', 'expert'].forEach((diff) => {
  const t0 = Date.now();
  const r = P.generate(diff, P.rngFrom(2026 + diff.length * 17), { budgetMs: 1500 });
  const ms = Date.now() - t0;
  check(!!r, diff + ' generates a puzzle');
  if (!r) return;
  check(ms < 1000, diff + ' generated in ' + ms + 'ms (under 1s)');
  const sc = P.solveCount(r.puzzle, 2);
  check(sc.count === 1, diff + ' has a unique solution');
  check(P.fmt(sc.solution) === P.fmt(r.solution), diff + ' stored solution matches the solver');
  check(P.isValidBoard(r.solution) && P.clueCount(r.solution) === 81, diff + ' solution is a complete valid grid');
  const g = P.gradeDifficulty(r.puzzle);
  check(g.level === diff, diff + ' grades as ' + diff + ' (got ' + g.level + ', clues ' + g.clues + ', tech ' + g.maxTech + ')');
});

const diffs = Object.keys(BANK).filter((k) => Array.isArray(BANK[k]));
let bankOk = 0, bankBad = 0;
const counts = {};
diffs.forEach((diff) => {
  counts[diff] = BANK[diff].length;
  const seen = new Set();
  BANK[diff].forEach((pack, i) => {
    if (typeof pack !== 'string' || pack.length < 162) { bankBad++; return; }
    const clues = P.parse(pack.slice(0, 81));
    const sol = P.parse(pack.slice(81, 162));
    const key = pack.slice(0, 81);
    if (seen.has(key)) { bankBad++; return; }
    seen.add(key);
    const sc = P.solveCount(clues, 2);
    const g = P.gradeDifficulty(clues);
    const givenMatch = [...clues].every((v, i) => !v || v === sol[i]);
    if (sc.count === 1 && P.fmt(sc.solution) === P.fmt(sol) && g.level === diff && givenMatch && P.isValidBoard(sol)) bankOk++;
    else {
      bankBad++;
      if (bankBad <= 5) console.log('  bad', diff, i, 'unique', sc.count, 'grade', g, 'givenMatch', givenMatch);
    }
  });
});
check(diffs.length === 5 && counts.flash === 50 && counts.expert === 50, 'bank has 50 puzzles in each of 5 difficulties: ' + JSON.stringify(counts));
check(bankOk === 250 && bankBad === 0, 'all 250 bank puzzles are unique, valid, and graded correctly (' + bankOk + ' ok, ' + bankBad + ' bad)');

// A nearly full flash board is solvable by singles
const flash = P.generate('flash', P.rngFrom(1), { budgetMs: 400 });
check(flash && P.clueCount(flash.puzzle) >= 64, 'flash leaves a nearly full board (' + (flash ? flash.clues : 0) + ' clues)');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
