// Sudoku generation, unique-solution check, and human-style grading.
// Works in the browser and in Node.
(function (root) {
  const ALL = 0x1FF;
  const UNITS = [];
  const PEERS = Array.from({ length: 81 }, () => []);

  (function buildUnits() {
    for (let r = 0; r < 9; r++) {
      const u = [];
      for (let c = 0; c < 9; c++) u.push(r * 9 + c);
      UNITS.push(u);
    }
    for (let c = 0; c < 9; c++) {
      const u = [];
      for (let r = 0; r < 9; r++) u.push(r * 9 + c);
      UNITS.push(u);
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const u = [];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) u.push((br * 3 + r) * 9 + (bc * 3 + c));
        }
        UNITS.push(u);
      }
    }
    for (let i = 0; i < 81; i++) {
      const seen = new Set();
      const r = (i / 9) | 0, c = i % 9;
      const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      UNITS[r].forEach((x) => { if (x !== i) seen.add(x); });
      UNITS[9 + c].forEach((x) => { if (x !== i) seen.add(x); });
      UNITS[18 + b].forEach((x) => { if (x !== i) seen.add(x); });
      PEERS[i] = Array.from(seen);
    }
  })();

  function bit(n) { return 1 << (n - 1); }
  function popcnt(x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    return (((x + (x >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
  }
  function firstNum(mask) {
    let n = 1, v = mask & -mask;
    while (v > 1) { v >>= 1; n++; }
    return n;
  }
  function numsOf(mask) {
    const out = [];
    for (let n = 1; n <= 9; n++) if (mask & bit(n)) out.push(n);
    return out;
  }

  function rngFrom(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function parse(s) {
    const b = new Uint8Array(81);
    for (let i = 0; i < 81; i++) {
      const ch = s.charCodeAt(i);
      b[i] = ch >= 49 && ch <= 57 ? ch - 48 : 0;
    }
    return b;
  }
  function fmt(b) {
    let s = '';
    for (let i = 0; i < 81; i++) s += b[i] ? String(b[i]) : '0';
    return s;
  }
  function clueCount(board) {
    let n = 0;
    for (let i = 0; i < 81; i++) if (board[i]) n++;
    return n;
  }
  function isValidBoard(board) {
    for (let i = 0; i < 81; i++) {
      if (!board[i]) continue;
      for (let k = 0; k < PEERS[i].length; k++) {
        if (board[PEERS[i][k]] === board[i]) return false;
      }
    }
    return true;
  }

  // A known valid grid, shuffled by bands/stacks/digits to make new complete boards quickly.
  const BASE = parse('123456789456789123789123456231564897564897231897231564312645978645978312978312645');

  function fillComplete(rnd) {
    const b = BASE.slice();
    const map = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd);
    for (let i = 0; i < 81; i++) b[i] = map[b[i] - 1];
    // Swap row bands, then rows within each band.
    const bands = shuffle([0, 1, 2], rnd);
    const rows = [];
    for (let i = 0; i < 3; i++) {
      const band = bands[i];
      const inner = shuffle([0, 1, 2], rnd);
      for (let k = 0; k < 3; k++) rows.push(band * 3 + inner[k]);
    }
    const tmp = b.slice();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) b[r * 9 + c] = tmp[rows[r] * 9 + c];
    }
    const stacks = shuffle([0, 1, 2], rnd);
    const cols = [];
    for (let i = 0; i < 3; i++) {
      const stack = stacks[i];
      const inner = shuffle([0, 1, 2], rnd);
      for (let k = 0; k < 3; k++) cols.push(stack * 3 + inner[k]);
    }
    tmp.set(b);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) b[r * 9 + c] = tmp[r * 9 + cols[c]];
    }
    if (rnd() < 0.5) {
      // Transpose
      tmp.set(b);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) b[r * 9 + c] = tmp[c * 9 + r];
      }
    }
    return b;
  }

  function solveCount(board, limit) {
    const cell = board.slice();
    const row = new Uint16Array(9);
    const col = new Uint16Array(9);
    const box = new Uint16Array(9);
    for (let i = 0; i < 81; i++) if (cell[i]) {
      const r = (i / 9) | 0, c = i % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      const m = bit(cell[i]);
      if (row[r] & m || col[c] & m || box[bx] & m) return { count: 0, solution: null };
      row[r] |= m; col[c] |= m; box[bx] |= m;
    }
    let count = 0;
    let solution = null;

    function rec() {
      if (count >= limit) return;
      let bi = -1, bmask = 0, bn = 10;
      for (let i = 0; i < 81; i++) {
        if (cell[i]) continue;
        const r = (i / 9) | 0, c = i % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
        const m = ALL & ~(row[r] | col[c] | box[bx]);
        const n = popcnt(m);
        if (n === 0) return;
        if (n < bn) { bn = n; bi = i; bmask = m; if (n === 1) break; }
      }
      if (bi === -1) {
        count++;
        if (!solution) solution = cell.slice();
        return;
      }
      const r = (bi / 9) | 0, c = bi % 9, bx = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      let m = bmask;
      while (m) {
        const bt = m & -m;
        m ^= bt;
        const n = firstNum(bt);
        cell[bi] = n;
        row[r] |= bt; col[c] |= bt; box[bx] |= bt;
        rec();
        cell[bi] = 0;
        row[r] ^= bt; col[c] ^= bt; box[bx] ^= bt;
        if (count >= limit) return;
      }
    }
    rec();
    return { count, solution };
  }

  const TECH = {
    NAKED_SINGLE: 1,
    HIDDEN_SINGLE: 2,
    NAKED_PAIR: 3,
    HIDDEN_PAIR: 4,
    POINTING: 5,
    NAKED_TRIPLE: 6,
    HIDDEN_TRIPLE: 7,
    XWING: 8
  };

  function candidatesOf(board) {
    const cand = new Uint16Array(81);
    for (let i = 0; i < 81; i++) {
      if (board[i]) { cand[i] = 0; continue; }
      let m = ALL;
      for (let k = 0; k < PEERS[i].length; k++) {
        const v = board[PEERS[i][k]];
        if (v) m &= ~bit(v);
      }
      cand[i] = m;
    }
    return cand;
  }

  function applyTechniques(board) {
    const b = board.slice();
    const cand = candidatesOf(b);
    let maxTech = 0;
    let progress = true;
    let guard = 0;

    function assign(i, n, tech) {
      b[i] = n;
      cand[i] = 0;
      const bn = bit(n);
      for (let k = 0; k < PEERS[i].length; k++) cand[PEERS[i][k]] &= ~bn;
      if (tech > maxTech) maxTech = tech;
    }

    while (progress && guard++ < 250) {
      progress = false;

      for (let i = 0; i < 81; i++) {
        if (b[i]) continue;
        if (cand[i] === 0) return { solved: false, maxTech, board: b, stuck: true };
        if (popcnt(cand[i]) === 1) {
          assign(i, firstNum(cand[i]), TECH.NAKED_SINGLE);
          progress = true;
        }
      }
      if (progress) continue;

      for (let u = 0; u < UNITS.length; u++) {
        const unit = UNITS[u];
        for (let n = 1; n <= 9; n++) {
          const bn = bit(n);
          let loc = -1, cnt = 0, blocked = false;
          for (let k = 0; k < 9; k++) {
            const i = unit[k];
            if (b[i] === n) { blocked = true; break; }
            if (!b[i] && (cand[i] & bn)) { cnt++; loc = i; }
          }
          if (!blocked && cnt === 1) {
            assign(loc, n, TECH.HIDDEN_SINGLE);
            progress = true;
          }
        }
      }
      if (progress) continue;

      for (let u = 0; u < UNITS.length; u++) {
        const empties = [];
        const unit = UNITS[u];
        for (let k = 0; k < 9; k++) if (!b[unit[k]]) empties.push(unit[k]);
        for (let a = 0; a < empties.length; a++) {
          for (let c = a + 1; c < empties.length; c++) {
            const i = empties[a], j = empties[c];
            if (cand[i] === cand[j] && popcnt(cand[i]) === 2) {
              const mask = cand[i];
              for (let t = 0; t < empties.length; t++) {
                const k = empties[t];
                if (k === i || k === j) continue;
                if (cand[k] & mask) {
                  cand[k] &= ~mask;
                  if (TECH.NAKED_PAIR > maxTech) maxTech = TECH.NAKED_PAIR;
                  progress = true;
                }
              }
            }
          }
        }
      }
      if (progress) continue;

      for (let u = 0; u < UNITS.length; u++) {
        const empties = [];
        const unit = UNITS[u];
        for (let k = 0; k < 9; k++) if (!b[unit[k]]) empties.push(unit[k]);
        for (let n1 = 1; n1 <= 8; n1++) {
          const c1 = [];
          for (let t = 0; t < empties.length; t++) if (cand[empties[t]] & bit(n1)) c1.push(empties[t]);
          if (c1.length !== 2) continue;
          for (let n2 = n1 + 1; n2 <= 9; n2++) {
            const c2 = [];
            for (let t = 0; t < empties.length; t++) if (cand[empties[t]] & bit(n2)) c2.push(empties[t]);
            if (c2.length !== 2) continue;
            if (c1[0] === c2[0] && c1[1] === c2[1]) {
              const mask = bit(n1) | bit(n2);
              for (let t = 0; t < 2; t++) {
                const i = c1[t];
                if (cand[i] & ~mask) {
                  cand[i] &= mask;
                  if (TECH.HIDDEN_PAIR > maxTech) maxTech = TECH.HIDDEN_PAIR;
                  progress = true;
                }
              }
            }
          }
        }
      }
      if (progress) continue;

      // Pointing (box → line) and claiming (line → box)
      for (let box = 0; box < 9; box++) {
        const unit = UNITS[18 + box];
        for (let n = 1; n <= 9; n++) {
          const bn = bit(n);
          const locs = [];
          for (let k = 0; k < 9; k++) {
            const i = unit[k];
            if (!b[i] && (cand[i] & bn)) locs.push(i);
          }
          if (locs.length < 2) continue;
          let sameR = true, sameC = true;
          const r0 = (locs[0] / 9) | 0, c0 = locs[0] % 9;
          for (let t = 1; t < locs.length; t++) {
            if (((locs[t] / 9) | 0) !== r0) sameR = false;
            if ((locs[t] % 9) !== c0) sameC = false;
          }
          if (sameR) {
            for (let c = 0; c < 9; c++) {
              const i = r0 * 9 + c;
              if (b[i] || (cand[i] & bn) === 0) continue;
              let inBox = false;
              for (let k = 0; k < 9; k++) if (unit[k] === i) { inBox = true; break; }
              if (inBox) continue;
              cand[i] &= ~bn;
              if (TECH.POINTING > maxTech) maxTech = TECH.POINTING;
              progress = true;
            }
          }
          if (sameC) {
            for (let r = 0; r < 9; r++) {
              const i = r * 9 + c0;
              if (b[i] || (cand[i] & bn) === 0) continue;
              let inBox = false;
              for (let k = 0; k < 9; k++) if (unit[k] === i) { inBox = true; break; }
              if (inBox) continue;
              cand[i] &= ~bn;
              if (TECH.POINTING > maxTech) maxTech = TECH.POINTING;
              progress = true;
            }
          }
        }
      }
      for (let u = 0; u < 18; u++) {
        const unit = UNITS[u];
        for (let n = 1; n <= 9; n++) {
          const bn = bit(n);
          const locs = [];
          for (let k = 0; k < 9; k++) {
            const i = unit[k];
            if (!b[i] && (cand[i] & bn)) locs.push(i);
          }
          if (locs.length < 2) continue;
          const b0 = ((((locs[0] / 9) | 0) / 3) | 0) * 3 + (((locs[0] % 9) / 3) | 0);
          let same = true;
          for (let t = 1; t < locs.length; t++) {
            const bx = ((((locs[t] / 9) | 0) / 3) | 0) * 3 + (((locs[t] % 9) / 3) | 0);
            if (bx !== b0) { same = false; break; }
          }
          if (!same) continue;
          const boxUnit = UNITS[18 + b0];
          for (let k = 0; k < 9; k++) {
            const i = boxUnit[k];
            if (b[i] || (cand[i] & bn) === 0) continue;
            let inLine = false;
            for (let t = 0; t < 9; t++) if (unit[t] === i) { inLine = true; break; }
            if (inLine) continue;
            cand[i] &= ~bn;
            if (TECH.POINTING > maxTech) maxTech = TECH.POINTING;
            progress = true;
          }
        }
      }
      if (progress) continue;

      for (let u = 0; u < UNITS.length; u++) {
        const empties = [];
        const unit = UNITS[u];
        for (let k = 0; k < 9; k++) if (!b[unit[k]]) empties.push(unit[k]);
        const nE = empties.length;
        for (let a = 0; a < nE; a++) {
          for (let c = a + 1; c < nE; c++) {
            for (let d = c + 1; d < nE; d++) {
              const i = empties[a], j = empties[c], k = empties[d];
              const union = cand[i] | cand[j] | cand[k];
              if (popcnt(union) !== 3) continue;
              if (popcnt(cand[i]) > 3 || popcnt(cand[j]) > 3 || popcnt(cand[k]) > 3) continue;
              for (let t = 0; t < nE; t++) {
                const x = empties[t];
                if (x === i || x === j || x === k) continue;
                if (cand[x] & union) {
                  cand[x] &= ~union;
                  if (TECH.NAKED_TRIPLE > maxTech) maxTech = TECH.NAKED_TRIPLE;
                  progress = true;
                }
              }
            }
          }
        }
      }
      if (progress) continue;

      for (let u = 0; u < UNITS.length; u++) {
        const empties = [];
        const unit = UNITS[u];
        for (let k = 0; k < 9; k++) if (!b[unit[k]]) empties.push(unit[k]);
        for (let n1 = 1; n1 <= 7; n1++) {
          for (let n2 = n1 + 1; n2 <= 8; n2++) {
            for (let n3 = n2 + 1; n3 <= 9; n3++) {
              const mask = bit(n1) | bit(n2) | bit(n3);
              const locs = [];
              for (let t = 0; t < empties.length; t++) {
                if (cand[empties[t]] & mask) locs.push(empties[t]);
              }
              if (locs.length !== 3) continue;
              for (let t = 0; t < 3; t++) {
                const i = locs[t];
                if (cand[i] & ~mask) {
                  cand[i] &= mask;
                  if (TECH.HIDDEN_TRIPLE > maxTech) maxTech = TECH.HIDDEN_TRIPLE;
                  progress = true;
                }
              }
            }
          }
        }
      }
      if (progress) continue;

      for (let n = 1; n <= 9; n++) {
        const bn = bit(n);
        const rowCols = [];
        for (let r = 0; r < 9; r++) {
          const cols = [];
          for (let c = 0; c < 9; c++) {
            const i = r * 9 + c;
            if (!b[i] && (cand[i] & bn)) cols.push(c);
          }
          rowCols[r] = cols;
        }
        for (let r1 = 0; r1 < 8; r1++) {
          if (rowCols[r1].length !== 2) continue;
          for (let r2 = r1 + 1; r2 < 9; r2++) {
            if (rowCols[r2].length !== 2) continue;
            if (rowCols[r1][0] !== rowCols[r2][0] || rowCols[r1][1] !== rowCols[r2][1]) continue;
            const c1 = rowCols[r1][0], c2 = rowCols[r1][1];
            for (let r = 0; r < 9; r++) {
              if (r === r1 || r === r2) continue;
              for (const c of [c1, c2]) {
                const i = r * 9 + c;
                if (!b[i] && (cand[i] & bn)) {
                  cand[i] &= ~bn;
                  if (TECH.XWING > maxTech) maxTech = TECH.XWING;
                  progress = true;
                }
              }
            }
          }
        }
        const colRows = [];
        for (let c = 0; c < 9; c++) {
          const rows = [];
          for (let r = 0; r < 9; r++) {
            const i = r * 9 + c;
            if (!b[i] && (cand[i] & bn)) rows.push(r);
          }
          colRows[c] = rows;
        }
        for (let c1 = 0; c1 < 8; c1++) {
          if (colRows[c1].length !== 2) continue;
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            if (colRows[c2].length !== 2) continue;
            if (colRows[c1][0] !== colRows[c2][0] || colRows[c1][1] !== colRows[c2][1]) continue;
            const r1 = colRows[c1][0], r2 = colRows[c1][1];
            for (let c = 0; c < 9; c++) {
              if (c === c1 || c === c2) continue;
              for (const r of [r1, r2]) {
                const i = r * 9 + c;
                if (!b[i] && (cand[i] & bn)) {
                  cand[i] &= ~bn;
                  if (TECH.XWING > maxTech) maxTech = TECH.XWING;
                  progress = true;
                }
              }
            }
          }
        }
      }
    }

    let solved = true;
    for (let i = 0; i < 81; i++) if (!b[i]) { solved = false; break; }
    return { solved, maxTech, board: b };
  }

  function gradeDifficulty(puzzle) {
    const clues = clueCount(puzzle);
    const g = applyTechniques(puzzle);
    if (clues >= 60) return { level: 'flash', maxTech: g.maxTech, clues, solved: g.solved };
    if (!g.solved) return { level: 'expert', maxTech: g.maxTech, clues, solved: false };
    if (g.maxTech <= TECH.HIDDEN_SINGLE) return { level: 'easy', maxTech: g.maxTech, clues, solved: true };
    if (g.maxTech <= TECH.HIDDEN_PAIR) return { level: 'medium', maxTech: g.maxTech, clues, solved: true };
    if (g.maxTech <= TECH.HIDDEN_TRIPLE) return { level: 'hard', maxTech: g.maxTech, clues, solved: true };
    return { level: 'expert', maxTech: g.maxTech, clues, solved: true };
  }

  const RANK = { flash: 0, easy: 1, medium: 2, hard: 3, expert: 4 };

  function tryRemove(puzzle, i, symmetric) {
    if (!puzzle[i]) return false;
    const j = symmetric ? 80 - i : i;
    const bakI = puzzle[i], bakJ = puzzle[j];
    puzzle[i] = 0;
    if (j !== i) puzzle[j] = 0;
    const sc = solveCount(puzzle, 2);
    if (sc.count !== 1) {
      puzzle[i] = bakI;
      if (j !== i) puzzle[j] = bakJ;
      return false;
    }
    return true;
  }

  function generate(diff, rnd, opts) {
    opts = opts || {};
    const budget = opts.budgetMs == null ? 800 : opts.budgetMs;
    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const target = RANK[diff];
    const minClues = { flash: 64, easy: 36, medium: 28, hard: 24, expert: 22 }[diff] || 22;
    const maxClues = { flash: 72, easy: 50, medium: 38, hard: 34, expert: 28 }[diff] || 50;

    while (now() - t0 < budget) {
      const complete = fillComplete(rnd);
      if (diff === 'flash') {
        const puzzle = complete.slice();
        const cells = shuffle(Array.from({ length: 81 }, (_, i) => i), rnd);
        const holes = 9 + ((rnd() * 9) | 0);
        let removed = 0;
        for (let k = 0; k < cells.length && removed < holes; k++) {
          const i = cells[k];
          const bak = puzzle[i];
          puzzle[i] = 0;
          if (solveCount(puzzle, 2).count !== 1) puzzle[i] = bak;
          else removed++;
        }
        if (removed >= 9) {
          return { puzzle, solution: complete, difficulty: 'flash', clues: clueCount(puzzle), maxTech: 0 };
        }
        continue;
      }

      const puzzle = complete.slice();
      const order = shuffle(Array.from({ length: 81 }, (_, i) => i), rnd);
      const symmetric = rnd() < 0.55;
      let best = null;

      for (let k = 0; k < order.length; k++) {
        if (now() - t0 >= budget) break;
        const i = order[k];
        if (!puzzle[i]) continue;
        const j = symmetric ? 80 - i : i;
        const bakI = puzzle[i], bakJ = puzzle[j];
        puzzle[i] = 0;
        if (j !== i) puzzle[j] = 0;
        if (solveCount(puzzle, 2).count !== 1) {
          puzzle[i] = bakI;
          if (j !== i) puzzle[j] = bakJ;
          continue;
        }
        const g = gradeDifficulty(puzzle);
        if (RANK[g.level] > target) {
          puzzle[i] = bakI;
          if (j !== i) puzzle[j] = bakJ;
          continue;
        }
        if (RANK[g.level] === target && g.clues >= minClues && g.clues <= maxClues) {
          best = { puzzle: puzzle.slice(), solution: complete, difficulty: diff, clues: g.clues, maxTech: g.maxTech };
          if (g.clues <= minClues + 1) break;
        }
      }
      if (best) return best;
    }
    return null;
  }

  const API = {
    parse, fmt, fillComplete, solveCount, gradeDifficulty, generate,
    clueCount, applyTechniques, TECH, UNITS, PEERS, rngFrom, shuffle,
    isValidBoard, candidatesOf, bit, popcnt, firstNum, numsOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ST_PUZZLE = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
