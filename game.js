// Sudoku Tiles — menus, play, scoring, stats and saving.
(function () {
  const CFG = window.ST;
  const P = window.ST_PUZZLE;
  const BANK = window.ST_BANK || {};
  const A = window.ST_AUDIO;

  const $ = (id) => document.getElementById(id);
  const padJitter = [
    { r: -3.2, y: 5 }, { r: 2.4, y: 0 }, { r: -1.6, y: 7 },
    { r: 3.1, y: 2 }, { r: -2.8, y: 6 }, { r: 1.4, y: 1 },
    { r: -3.6, y: 3 }, { r: 2.2, y: 8 }, { r: -1.1, y: 2 }
  ];
  const letterJitter = {
    S: { r: -4.2, y: 3 }, U: { r: 2.1, y: 0 }, D: { r: -2.4, y: 5 },
    O: { r: 3.3, y: 1 }, K: { r: -3.1, y: 4 },
    T: { r: 2.4, y: 2 }, I: { r: -3.2, y: 0 }, L: { r: 1.2, y: 5 },
    E: { r: -2.0, y: 1 }
  };

  function defaultPer() {
    const per = {};
    CFG.DIFFICULTIES.forEach((d) => {
      per[d] = { bestScore: 0, bestRun: 0, run: 0, bestTime: null, played: 0, perfect: 0 };
    });
    return per;
  }
  function defaultSave() {
    return {
      v: 1,
      look: 'walnut',
      options: { highlightSame: true, autoNotes: true, showMistakes: true, sound: true },
      stats: { highScore: 0, gamesPlayed: 0, perfectGames: 0, playtimeMs: 0, per: defaultPer() },
      used: { flash: [], easy: [], medium: [], hard: [], expert: [] },
      game: null
    };
  }

  const save = loadSave();
  const state = {
    screen: 'title',
    menu: 'root',
    game: null,
    modalOpen: false
  };

  function loadSave() {
    try {
      if (/[?&]reset=1\b/.test(location.search)) {
        localStorage.removeItem(CFG.STORAGE_KEY);
        return defaultSave();
      }
      const raw = localStorage.getItem(CFG.STORAGE_KEY);
      if (!raw) return defaultSave();
      const s = JSON.parse(raw);
      const base = defaultSave();
      if (s.look) base.look = s.look;
      if (s.options) Object.assign(base.options, s.options);
      if (s.stats) {
        Object.assign(base.stats, s.stats);
        base.stats.per = defaultPer();
        if (s.stats.per) {
          CFG.DIFFICULTIES.forEach((d) => { if (s.stats.per[d]) Object.assign(base.stats.per[d], s.stats.per[d]); });
        }
      }
      if (s.used) base.used = Object.assign(base.used, s.used);
      if (s.game) base.game = s.game;
      return base;
    } catch (e) {
      return defaultSave();
    }
  }
  function persist() {
    try {
      const g = state.game;
      save.game = g && !g.won ? serializeGame(g) : (g && g.won ? null : save.game);
      if (g && g.won) save.game = null;
      localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(save));
    } catch (e) { /* quota */ }
  }

  function serializeGame(g) {
    return {
      difficulty: g.difficulty,
      clues: P.fmt(g.clues),
      solution: P.fmt(g.solution),
      grid: P.fmt(g.grid),
      notes: Array.from(g.notes),
      selectedCell: g.selectedCell,
      selectedNum: g.selectedNum,
      notesMode: g.notesMode,
      mistakes: g.mistakes,
      score: g.score,
      elapsedMs: currentElapsed(g),
      undo: g.undo,
      startedAt: g.startedAt,
      bankIndex: g.bankIndex
    };
  }
  function hydrateGame(s) {
    return {
      difficulty: s.difficulty,
      clues: P.parse(s.clues),
      solution: P.parse(s.solution),
      grid: P.parse(s.grid),
      notes: Uint16Array.from(s.notes || []),
      selectedCell: s.selectedCell == null ? -1 : s.selectedCell,
      selectedNum: s.selectedNum || 0,
      notesMode: !!s.notesMode,
      mistakes: s.mistakes || 0,
      score: s.score || 0,
      elapsedMs: s.elapsedMs || 0,
      running: false,
      lastTick: 0,
      undo: s.undo || [],
      startedAt: s.startedAt || Date.now(),
      won: false,
      bankIndex: s.bankIndex
    };
  }

  function currentElapsed(g) {
    if (!g) return 0;
    let ms = g.elapsedMs;
    if (g.running && g.lastTick) ms += Date.now() - g.lastTick;
    return ms;
  }
  function pauseTimer(flush) {
    const g = state.game;
    if (!g || g.won) return;
    if (g.running && g.lastTick) {
      g.elapsedMs += Date.now() - g.lastTick;
      if (flush) {
        save.stats.playtimeMs += Date.now() - g.lastTick;
        g.lastTick = 0;
      }
    }
    g.running = false;
    g.lastTick = 0;
  }
  function resumeTimer() {
    const g = state.game;
    if (!g || g.won || state.screen !== 'game' || state.modalOpen) return;
    g.running = true;
    g.lastTick = Date.now();
  }

  // ---------- textures ----------
  function noiseCanvas(w, h, paint) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    return c.toDataURL('image/png');
  }
  function makeParchment() {
    return noiseCanvas(400, 400, (ctx, w, h) => {
      ctx.fillStyle = '#e6d2a8';
      ctx.fillRect(0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 28;
        d[i] = Math.max(0, Math.min(255, d[i] + n - 4));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n - 8));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n - 18));
      }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = 'rgba(120, 80, 40, 0.03)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 7) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.random() * 2);
        ctx.lineTo(w, y + Math.random() * 2);
        ctx.stroke();
      }
    });
  }
  function makeLinen() {
    return noiseCanvas(280, 280, (ctx, w, h) => {
      ctx.fillStyle = '#f4ebd6';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(160, 130, 80, 0.07)';
      for (let x = 0; x < w; x += 3) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(160, 130, 80, 0.05)';
      for (let y = 0; y < h; y += 3) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 16;
        d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8;
      }
      ctx.putImageData(img, 0, 0);
    });
  }
  function makeWood(look) {
    const pal = {
      walnut: ['#6b4423', '#3f2410', '#8d5a2c', '#c4a06a'],
      maple: ['#d2a55a', '#a87a32', '#e6c57a', '#f3e0b0'],
      cherry: ['#8e3a2f', '#5a1e18', '#b24c3c', '#d4907a']
    }[look] || palWalnut();
    function palWalnut() { return ['#6b4423', '#3f2410', '#8d5a2c', '#c4a06a']; }
    return noiseCanvas(140, 140, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, pal[2]);
      g.addColorStop(0.5, pal[0]);
      g.addColorStop(1, pal[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) {
        const x = (i / 18) * w + Math.sin(i * 1.7) * 4;
        ctx.strokeStyle = i % 3 === 0 ? pal[1] : pal[3];
        ctx.globalAlpha = 0.18 + (i % 4) * 0.04;
        ctx.lineWidth = i % 4 === 0 ? 2.2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= h; y += 6) {
          ctx.lineTo(x + Math.sin(y / 11 + i) * 3.5, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 18;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
    });
  }
  const woodTex = {};
  function applyTextures() {
    const app = $('app');
    app.style.setProperty('--parchment-tex', 'url(' + makeParchment() + ')');
    app.style.setProperty('--linen-tex', 'url(' + makeLinen() + ')');
    CFG.LOOKS.forEach((look) => { woodTex[look] = makeWood(look); });
    applyLook(save.look, true);
  }
  function applyLook(look, silent) {
    if (CFG.LOOKS.indexOf(look) < 0) look = 'walnut';
    save.look = look;
    $('app').setAttribute('data-look', look);
    $('app').style.setProperty('--wood-tex', 'url(' + woodTex[look] + ')');
    const t = $('title-look');
    if (t) {
      t.className = 'look-tile tile';
      t.style.setProperty('--rx', '4deg');
      t.textContent = '5';
      t.setAttribute('aria-label', 'Look: ' + CFG.LOOK_LABELS[look] + '. Tap to change.');
    }
    if (!silent) persist();
  }

  // ---------- screens ----------
  function showScreen(name) {
    ['title', 'game', 'stats', 'options', 'help', 'about'].forEach((s) => {
      const el = $('screen-' + s);
      if (el) el.classList.toggle('hidden', s !== name);
    });
    state.screen = name;
    if (name !== 'game') pauseTimer(true);
    if (name === 'game') resumeTimer();
    if (name === 'stats') renderStats();
    if (name === 'options') renderOptions();
  }
  function goTitle() {
    pauseTimer(true);
    persist();
    state.menu = 'root';
    renderMenu();
    showScreen('title');
  }

  function renderMenu() {
    $('menu-root').classList.toggle('hidden', state.menu !== 'root');
    $('menu-play').classList.toggle('hidden', state.menu !== 'play');
    const g = save.game || (state.game && !state.game.won ? serializeGame(state.game) : null);
    const has = !!(g && g.grid);
    $('btn-resume').classList.toggle('hidden', !has);
    const note = $('paused-note');
    if (has) {
      note.textContent = '~ ' + CFG.LABELS[g.difficulty] + ' ~ Game Paused';
      note.classList.remove('hidden');
    } else {
      note.classList.add('hidden');
    }
  }

  function buildTitle() {
    function word(id, letters) {
      const el = $(id);
      el.innerHTML = '';
      letters.split('').forEach((ch, i) => {
        const t = document.createElement('div');
        const j = letterJitter[ch] || { r: (i % 2 ? 2 : -2), y: i };
        t.className = 'tile';
        t.style.setProperty('--rx', j.r + 'deg');
        t.style.setProperty('--ty', j.y + 'px');
        t.textContent = ch;
        el.appendChild(t);
      });
    }
    word('word-sudoku', 'SUDOKU');
    word('word-tiles', 'TILES');
    const grid = $('faded-grid');
    grid.innerHTML = '';
    const sample = P.fillComplete(P.rngFrom(9));
    for (let b = 0; b < 9; b++) {
      const box = document.createElement('div');
      box.className = 'box';
      const br = (b / 3) | 0, bc = b % 3;
      for (let k = 0; k < 9; k++) {
        const r = br * 3 + ((k / 3) | 0);
        const c = bc * 3 + (k % 3);
        const i = r * 9 + c;
        const cell = document.createElement('div');
        cell.className = 'cell';
        if ((i * 7 + 3) % 5 !== 0) {
          const t = document.createElement('div');
          t.className = 'tile';
          t.textContent = sample[i];
          cell.appendChild(t);
        }
        box.appendChild(cell);
      }
      grid.appendChild(box);
    }
  }

  function buildBoard() {
    const board = $('board');
    board.innerHTML = '';
    for (let b = 0; b < 9; b++) {
      const box = document.createElement('div');
      box.className = 'box';
      const br = (b / 3) | 0, bc = b % 3;
      for (let k = 0; k < 9; k++) {
        const r = br * 3 + ((k / 3) | 0);
        const c = bc * 3 + (k % 3);
        const i = r * 9 + c;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.i = String(i);
        cell.setAttribute('role', 'gridcell');
        cell.addEventListener('click', () => onCell(i));
        box.appendChild(cell);
      }
      board.appendChild(box);
    }
  }
  function buildPad() {
    const pad = $('pad');
    pad.innerHTML = '';
    for (let n = 1; n <= 9; n++) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'tile';
      t.dataset.n = String(n);
      t.textContent = String(n);
      const j = padJitter[n - 1];
      t.style.setProperty('--rx', j.r + 'deg');
      t.style.setProperty('--ty', j.y + 'px');
      t.addEventListener('click', () => onPad(n));
      pad.appendChild(t);
    }
  }

  // ---------- puzzles ----------
  function pickPuzzle(diff) {
    const bank = BANK[diff] || [];
    if (bank.length) {
      if (!save.used[diff]) save.used[diff] = [];
      let pool = bank.map((_, i) => i).filter((i) => save.used[diff].indexOf(i) < 0);
      if (!pool.length) { save.used[diff] = []; pool = bank.map((_, i) => i); }
      const i = pool[(Math.random() * pool.length) | 0];
      save.used[diff].push(i);
      const pack = bank[i];
      const clues = P.parse(pack.slice(0, 81));
      const solution = P.parse(pack.slice(81, 162));
      return { clues, solution, bankIndex: i };
    }
    const r = P.generate(diff, P.rngFrom((Date.now() ^ (Math.random() * 1e9)) >>> 0), { budgetMs: 900 });
    if (!r) throw new Error('Could not make a puzzle in time');
    return { clues: r.puzzle, solution: r.solution, bankIndex: -1 };
  }

  function startGame(diff, existing) {
    if (existing) {
      state.game = existing;
    } else {
      const p = pickPuzzle(diff);
      state.game = {
        difficulty: diff,
        clues: p.clues,
        solution: p.solution,
        grid: p.clues.slice(),
        notes: new Uint16Array(81),
        selectedCell: -1,
        selectedNum: 0,
        notesMode: false,
        mistakes: 0,
        score: 0,
        elapsedMs: 0,
        running: false,
        lastTick: 0,
        undo: [],
        startedAt: Date.now(),
        won: false,
        bankIndex: p.bankIndex
      };
    }
    showScreen('game');
    resumeTimer();
    renderGame();
    persist();
  }

  function requestNewGame(diff) {
    const inProgress = (state.game && !state.game.won) || (save.game && save.game.grid);
    if (inProgress) {
      const cur = state.game && !state.game.won ? state.game.difficulty : save.game.difficulty;
      confirmModal(
        'Start a new game?',
        'This will leave your current ' + CFG.LABELS[cur] + ' puzzle.',
        'New ' + CFG.LABELS[diff],
        () => startGame(diff)
      );
    } else {
      startGame(diff);
    }
  }

  // ---------- scoring & play ----------
  function cellPoints(diff) {
    return Math.round(CFG.SCORING.POINTS_PER_CELL * CFG.SCORING.DIFFICULTY_MULT[diff]);
  }
  function timeBonus(diff, elapsedMs) {
    const max = CFG.SCORING.TIME_BONUS_MAX[diff];
    const target = CFG.SCORING.TIME_TARGET_SEC[diff] * 1000;
    return Math.max(0, Math.round(max * (1 - elapsedMs / target)));
  }
  function countCorrect(g, n) {
    let c = 0;
    for (let i = 0; i < 81; i++) if (g.grid[i] === n && g.solution[i] === n) c++;
    return c;
  }
  function isGiven(g, i) { return g.clues[i] !== 0; }
  function isComplete(g) {
    for (let i = 0; i < 81; i++) if (g.grid[i] !== g.solution[i]) return false;
    return true;
  }

  function pushUndo() {
    const g = state.game;
    g.undo.push({
      grid: P.fmt(g.grid),
      notes: Array.from(g.notes),
      score: g.score,
      mistakes: g.mistakes
    });
    if (g.undo.length > 120) g.undo.shift();
  }

  function placeNumber(i, n, fromPad) {
    const g = state.game;
    if (!g || g.won || isGiven(g, i)) return;
    A.unlock();
    if (g.notesMode) {
      if (g.grid[i]) return;
      pushUndo();
      g.notes[i] ^= P.bit(n);
      A.pencil();
      renderGame();
      persist();
      return;
    }
    if (g.grid[i] === n) {
      pushUndo();
      if (g.grid[i] === g.solution[i]) g.score = Math.max(0, g.score - cellPoints(g.difficulty));
      g.grid[i] = 0;
      A.tap();
      renderGame();
      persist();
      return;
    }
    pushUndo();
    const prev = g.grid[i];
    if (prev && prev === g.solution[i]) g.score = Math.max(0, g.score - cellPoints(g.difficulty));
    g.grid[i] = n;
    g.notes[i] = 0;
    if (save.options.autoNotes) {
      const peers = P.PEERS[i];
      const bit = P.bit(n);
      for (let k = 0; k < peers.length; k++) g.notes[peers[k]] &= ~bit;
    }
    if (n === g.solution[i]) {
      g.score += cellPoints(g.difficulty);
      A.place();
    } else {
      g.mistakes++;
      A.error();
    }
    renderGame();
    if (isComplete(g)) winGame();
    else persist();
  }

  function onCell(i) {
    const g = state.game;
    if (!g || g.won) return;
    A.unlock();
    if (g.selectedNum && !isGiven(g, i)) {
      placeNumber(i, g.selectedNum, false);
      g.selectedCell = i;
      renderGame();
      return;
    }
    if (!g.selectedNum && g.selectedCell === i) {
      g.selectedCell = -1;
      A.tap();
      renderGame();
      return;
    }
    g.selectedCell = i;
    A.tap();
    renderGame();
  }
  function onPad(n) {
    const g = state.game;
    if (!g || g.won) return;
    A.unlock();
    // Cell-first: a selected empty cell and no armed number means "put this in that cell".
    // The number is not left armed, so the next cell tap selects instead of placing.
    // To place the same number in several cells, tap the number first (or again after placing).
    if (g.selectedCell >= 0 && !isGiven(g, g.selectedCell) && !g.selectedNum) {
      placeNumber(g.selectedCell, n, true);
      renderGame();
      return;
    }
    g.selectedNum = g.selectedNum === n ? 0 : n;
    A.tap();
    renderGame();
  }

  function undo() {
    const g = state.game;
    if (!g || g.won || !g.undo.length) return;
    const u = g.undo.pop();
    g.grid = P.parse(u.grid);
    g.notes = Uint16Array.from(u.notes);
    g.score = u.score;
    g.mistakes = u.mistakes;
    A.undo();
    renderGame();
    persist();
  }

  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = (s / 3600) | 0;
    const m = ((s % 3600) / 60) | 0;
    const sec = s % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    return m + ':' + String(sec).padStart(2, '0');
  }
  function formatPlaytime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = (s / 3600) | 0;
    const m = ((s % 3600) / 60) | 0;
    const sec = s % 60;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function winGame() {
    const g = state.game;
    if (g.won) return;
    pauseTimer(true);
    g.won = true;
    g.running = false;
    const elapsed = g.elapsedMs;
    const perfect = g.mistakes === 0;
    const tBonus = timeBonus(g.difficulty, elapsed);
    const pBonus = perfect ? CFG.SCORING.PERFECT_BONUS[g.difficulty] : 0;
    const total = g.score + tBonus + pBonus;
    const per = save.stats.per[g.difficulty];
    save.stats.gamesPlayed++;
    per.played++;
    if (perfect) {
      save.stats.perfectGames++;
      per.perfect++;
      per.run++;
      if (per.run > per.bestRun) per.bestRun = per.run;
    } else {
      per.run = 0;
    }
    if (total > save.stats.highScore) save.stats.highScore = total;
    if (total > per.bestScore) per.bestScore = total;
    if (per.bestTime == null || elapsed < per.bestTime) per.bestTime = elapsed;
    save.game = null;
    persist();
    A.win();
    burstWin();
    const bits = [
      '<p class="win-sub">' + CFG.LABELS[g.difficulty] + ' · ' + formatTime(elapsed) +
        (perfect ? ' · Perfect' : '') + '</p>',
      '<table class="breakdown">',
      '<tr><td>Correct numbers</td><td>' + g.score + '</td></tr>',
      '<tr><td>Time bonus</td><td>+' + tBonus + '</td></tr>'
    ];
    if (perfect) bits.push('<tr><td>Perfect game</td><td>+' + pBonus + '</td></tr>');
    bits.push('<tr class="total"><td>Total</td><td>' + total + '</td></tr></table>');
    if (per.run > 1) bits.push('<p>Run: ' + per.run + ' perfect in a row on ' + CFG.LABELS[g.difficulty] + '.</p>');
    else if (perfect) bits.push('<p>A clean sheet. That starts a new run.</p>');
    showModal('Well done!', bits.join(''), [
      { label: 'Play again', fn: () => { hideModal(); startGame(g.difficulty); } },
      { label: 'Menu', cls: 'ghost', fn: () => { hideModal(); state.game = null; goTitle(); } }
    ]);
    renderGame();
  }

  // ---------- render ----------
  function highlightNum(g) {
    if (!save.options.highlightSame) return 0;
    if (g.selectedNum) return g.selectedNum;
    if (g.selectedCell >= 0 && g.grid[g.selectedCell]) return g.grid[g.selectedCell];
    return 0;
  }
  function renderGame() {
    const g = state.game;
    if (!g) return;
    $('score').textContent = String(g.score);
    const mis = $('mistakes');
    mis.querySelector('b').textContent = String(g.mistakes);
    mis.classList.toggle('has-some', g.mistakes > 0);
    $('timer').textContent = '(' + formatTime(currentElapsed(g)) + ')';
    $('btn-pencil').classList.toggle('active', g.notesMode);
    $('btn-pencil').setAttribute('aria-pressed', g.notesMode ? 'true' : 'false');
    const hn = highlightNum(g);
    const cells = $('board').querySelectorAll('.cell');
    cells.forEach((cell) => {
      const i = +cell.dataset.i;
      const v = g.grid[i];
      const given = isGiven(g, i);
      cell.className = 'cell' + (v ? '' : ' empty') + (g.selectedCell === i ? ' selected' : '') + (hn && v === hn ? ' glow' : '');
      cell.innerHTML = '';
      if (v) {
        const t = document.createElement('div');
        const wrong = v !== g.solution[i];
        t.className = 'tile' + (given ? ' given' : '') + (wrong && save.options.showMistakes ? ' wrong' : '');
        t.textContent = String(v);
        cell.appendChild(t);
      } else if (g.notes[i]) {
        const notes = document.createElement('div');
        notes.className = 'notes';
        for (let n = 1; n <= 9; n++) {
          const s = document.createElement('span');
          s.textContent = (g.notes[i] & P.bit(n)) ? String(n) : '';
          notes.appendChild(s);
        }
        cell.appendChild(notes);
      }
    });
    const pad = $('pad').querySelectorAll('.tile');
    pad.forEach((t) => {
      const n = +t.dataset.n;
      t.classList.toggle('selected', g.selectedNum === n);
      t.classList.toggle('done', countCorrect(g, n) === 9);
    });
  }

  function renderStats() {
    const s = save.stats;
    const el = $('stats-body');
    let html = '<div class="totals">';
    html += stat('High score', s.highScore);
    html += stat('Games played', s.gamesPlayed);
    html += stat('Perfect games', s.perfectGames);
    html += stat('Playtime', formatPlaytime(s.playtimeMs));
    html += '</div>';
    CFG.DIFFICULTIES.forEach((d) => {
      const p = s.per[d];
      const icon = CFG.STAT_ICONS[d].map((on, i) => '<i class="' + (on ? 'on' : '') + '"></i>').join('');
      html += '<div class="diff-row"><div class="diff-icon" aria-hidden="true">' + icon + '</div><div class="diff-meta">';
      html += '<div class="diff-name">' + CFG.LABELS[d] + '</div>';
      html += '<div><div class="k">Best score</div><div class="v">' + (p.bestScore || '—') + '</div></div>';
      html += '<div><div class="k">Best run</div><div class="v">' + (p.bestRun || '—') + '</div></div>';
      html += '<div><div class="k">Best time</div><div class="v">' + (p.bestTime == null ? '—' : formatTime(p.bestTime)) + '</div></div>';
      html += '</div></div>';
    });
    el.innerHTML = html;
  }
  function stat(lbl, val) {
    return '<div class="stat"><span class="lbl">' + lbl + '</span><span class="val">' + val + '</span></div>';
  }

  function renderOptions() {
    const o = save.options;
    const body = $('options-body');
    const rows = [
      ['highlightSame', 'Highlight same numbers'],
      ['autoNotes', 'Auto-remove notes'],
      ['showMistakes', 'Show mistakes'],
      ['sound', 'Sound']
    ];
    body.innerHTML = rows.map(([key, label]) => {
      return '<button type="button" class="opt-row" data-opt="' + key + '"><span>' + label + '</span><span class="toggle' + (o[key] ? ' on' : '') + '"></span></button>';
    }).join('') +
      '<h2 style="margin:1.2rem 0 0;font-size:1.15rem">Choose Look</h2>' +
      '<div class="looks">' + CFG.LOOKS.map((look) => {
        return '<button type="button" class="cap" data-look="' + look + '"><span class="tile' + (save.look === look ? ' current' : '') + '" data-look-set="' + look + '">5</span>' + CFG.LOOK_LABELS[look] + '</button>';
      }).join('') + '</div>';
    body.querySelectorAll('[data-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-opt');
        o[key] = !o[key];
        if (key === 'sound') A.setMuted(!o.sound);
        A.click();
        persist();
        renderOptions();
        if (state.game && (key === 'highlightSame' || key === 'showMistakes')) renderGame();
      });
    });
    body.querySelectorAll('[data-look]').forEach((btn) => {
      btn.addEventListener('click', () => {
        A.click();
        applyLook(btn.getAttribute('data-look'));
        renderOptions();
      });
    });
  }

  // ---------- modal ----------
  function showModal(title, body, actions) {
    state.modalOpen = true;
    pauseTimer(false);
    $('m-title').textContent = title;
    $('m-body').innerHTML = body;
    const box = $('m-actions');
    box.innerHTML = '';
    (actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a.label;
      if (a.cls) b.className = a.cls;
      b.addEventListener('click', a.fn);
      box.appendChild(b);
    });
    $('overlay').classList.remove('hidden');
  }
  function hideModal() {
    $('overlay').classList.add('hidden');
    state.modalOpen = false;
    resumeTimer();
  }
  function confirmModal(title, body, okLabel, fn) {
    showModal(title, '<p>' + body + '</p>', [
      { label: okLabel || 'OK', fn: () => { hideModal(); fn(); } },
      { label: 'Cancel', cls: 'ghost', fn: hideModal }
    ]);
  }

  function showInfo() {
    const g = state.game;
    if (!g) return;
    const html = '<p><strong>' + CFG.LABELS[g.difficulty] + '</strong> · ' + formatTime(currentElapsed(g)) + '</p>' +
      '<p>Score so far: ' + g.score + '<br>Mistakes: ' + g.mistakes + '</p>' +
      '<p>A perfect game is one finished with no mistakes. There is no limit on mistakes — take your time.</p>';
    showModal('This game', html, [{ label: 'Close', fn: hideModal }]);
  }

  // ---------- celebration ----------
  const fx = $('fx');
  const fxCtx = fx.getContext('2d');
  let particles = [];
  function resizeFx() { fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; }
  function burstWin() {
    resizeFx();
    particles = [];
    const colors = ['#6b4423', '#c4a06a', '#8d5a2c', '#e6c896', '#d2a55a', '#8e3a2f'];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: fx.width * (0.3 + Math.random() * 0.4),
        y: fx.height * 0.35,
        vx: (Math.random() - 0.5) * 7 * devicePixelRatio,
        vy: (Math.random() * -8 - 2) * devicePixelRatio,
        s: (6 + Math.random() * 10) * devicePixelRatio,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1
      });
    }
    requestAnimationFrame(tickFx);
  }
  function tickFx() {
    if (!particles.length) { fxCtx.clearRect(0, 0, fx.width, fx.height); return; }
    fxCtx.clearRect(0, 0, fx.width, fx.height);
    const g = 0.18 * devicePixelRatio;
    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => {
      p.vy += g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.012;
      fxCtx.save();
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.rot);
      fxCtx.globalAlpha = Math.max(0, p.life);
      fxCtx.fillStyle = p.color;
      fxCtx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
      fxCtx.restore();
    });
    if (particles.length) requestAnimationFrame(tickFx);
  }

  // ---------- events ----------
  function onMenuClick(ev) {
    const btn = ev.target.closest('button');
    if (!btn) return;
    A.unlock(); A.click();
    const act = btn.getAttribute('data-act');
    const diff = btn.getAttribute('data-diff');
    if (act === 'play') { state.menu = 'play'; renderMenu(); }
    else if (act === 'root') { state.menu = 'root'; renderMenu(); }
    else if (act === 'stats') showScreen('stats');
    else if (act === 'options') showScreen('options');
    else if (act === 'help') showScreen('help');
    else if (act === 'about') showScreen('about');
    else if (diff) requestNewGame(diff);
  }
  $('menu-panel').addEventListener('click', onMenuClick);
  $('btn-resume').addEventListener('click', (ev) => {
    ev.stopPropagation();
    A.unlock(); A.click();
    const raw = state.game && !state.game.won ? state.game : (save.game ? hydrateGame(save.game) : null);
    if (raw) startGame(raw.difficulty, raw);
  });
  $('title-look').addEventListener('click', (ev) => {
    ev.stopPropagation();
    A.unlock(); A.click();
    const i = CFG.LOOKS.indexOf(save.look);
    applyLook(CFG.LOOKS[(i + 1) % CFG.LOOKS.length]);
  });
  $('btn-back').addEventListener('click', () => { A.click(); goTitle(); });
  document.querySelectorAll('.go-title').forEach((b) => b.addEventListener('click', () => { A.click(); goTitle(); }));
  $('btn-info').addEventListener('click', () => { A.click(); showInfo(); });
  $('btn-pencil').addEventListener('click', () => {
    if (!state.game || state.game.won) return;
    state.game.notesMode = !state.game.notesMode;
    A.click();
    renderGame();
  });
  $('btn-undo').addEventListener('click', undo);
  $('btn-restart').addEventListener('click', () => {
    if (!state.game) return;
    A.click();
    confirmModal('New puzzle?', 'Start a fresh ' + CFG.LABELS[state.game.difficulty] + ' puzzle? This one will be set aside.', 'New puzzle', () => {
      startGame(state.game.difficulty);
    });
  });
  $('btn-reset-stats').addEventListener('click', () => {
    A.click();
    confirmModal('Reset all stats?', 'This erases high scores, runs, playtime and games played. It cannot be undone.', 'Reset', () => {
      save.stats = defaultSave().stats;
      persist();
      renderStats();
    });
  });
  $('overlay').addEventListener('click', (ev) => { if (ev.target === $('overlay')) hideModal(); });

  document.addEventListener('keydown', (ev) => {
    if (state.screen !== 'game' || !state.game || state.game.won || state.modalOpen) return;
    const g = state.game;
    if (ev.key >= '1' && ev.key <= '9') { onPad(+ev.key); ev.preventDefault(); }
    else if (ev.key === 'Backspace' || ev.key === 'Delete' || ev.key === '0') {
      if (g.selectedCell >= 0 && !isGiven(g, g.selectedCell) && g.grid[g.selectedCell]) {
        pushUndo();
        if (g.grid[g.selectedCell] === g.solution[g.selectedCell]) g.score = Math.max(0, g.score - cellPoints(g.difficulty));
        g.grid[g.selectedCell] = 0;
        A.tap();
        renderGame();
        persist();
      }
      ev.preventDefault();
    } else if (ev.key === 'z' && (ev.metaKey || ev.ctrlKey || !ev.metaKey)) { undo(); ev.preventDefault(); }
    else if (ev.key === 'n' || ev.key === 'p') { g.notesMode = !g.notesMode; renderGame(); ev.preventDefault(); }
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      let i = g.selectedCell < 0 ? 40 : g.selectedCell;
      const r = (i / 9) | 0, c = i % 9;
      if (ev.key === 'ArrowLeft') i = r * 9 + (c + 8) % 9;
      if (ev.key === 'ArrowRight') i = r * 9 + (c + 1) % 9;
      if (ev.key === 'ArrowUp') i = ((r + 8) % 9) * 9 + c;
      if (ev.key === 'ArrowDown') i = ((r + 1) % 9) * 9 + c;
      g.selectedCell = i;
      renderGame();
      ev.preventDefault();
    }
  });

  setInterval(() => {
    if (state.game && state.game.running && state.screen === 'game' && !state.modalOpen && !state.game.won) {
      $('timer').textContent = '(' + formatTime(currentElapsed(state.game)) + ')';
    }
  }, 250);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseTimer(true); persist(); }
    else resumeTimer();
  });
  addEventListener('resize', resizeFx);

  // ---------- boot ----------
  applyTextures();
  buildTitle();
  buildBoard();
  buildPad();
  A.setMuted(!save.options.sound);
  if (save.game && save.game.grid) {
    state.game = hydrateGame(save.game);
  }
  renderMenu();
  showScreen('title');

  window.__st = {
    save, state, CFG,
    start: (d) => startGame(d),
    empties() {
      const g = state.game;
      if (!g) return [];
      const out = [];
      for (let i = 0; i < 81; i++) if (!g.clues[i]) out.push({ i, n: g.solution[i], cur: g.grid[i] });
      return out;
    },
    place: (i, n) => placeNumber(i, n),
    selectCell: (i) => onCell(i),
    selectNum: (n) => onPad(n),
    undo, persist,
    formatTime, formatPlaytime,
    showScreen, goTitle,
    renderGame, renderStats
  };
})();
