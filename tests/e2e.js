// Playwright end-to-end test at iPad and phone sizes.
// Usage: node tests/e2e.js [url] [outdir]
const { chromium } = require(process.env.PW_PATH || 'playwright');
const fs = require('fs');
const base = (process.argv[2] || 'http://127.0.0.1:8861/').replace(/\/?$/, '/');
const out = process.argv[3] || 'screenshots';
fs.mkdirSync(out, { recursive: true });
const errors = [], log = [];
const check = (c, m) => { log.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) errors.push(m); };

const IPAD = { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const IPAD_L = { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--disable-http-cache'] });
  const consoleErr = [];
  const watch = (page) => {
    page.on('pageerror', (e) => consoleErr.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') consoleErr.push(m.text()); });
  };
  const ready = async (page) => { await page.waitForFunction(() => window.__st && window.__st.state, null, { timeout: 30000 }); await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(150); };

  // 1. Title + play through a Flash game in iPad portrait
  let ctx = await browser.newContext(IPAD);
  let page = await ctx.newPage();
  watch(page);
  await page.goto(base + '?reset=1');
  await ready(page);
  await page.waitForTimeout(400);
  check(await page.evaluate(() => document.title) === 'Sudoku Tiles', 'title is Sudoku Tiles');
  check(await page.evaluate(() => !document.getElementById('screen-title').classList.contains('hidden')), 'title screen is visible');
  check(await page.evaluate(() => !document.querySelector('#btn-hint') && !document.getElementById('credits')), 'no hint button or credit counter');
  await page.screenshot({ path: out + '/01-ipad-title.png', fullPage: false });

  await page.click('[data-act="play"]');
  await page.waitForTimeout(200);
  check(await page.isVisible('[data-diff="flash"]'), 'Play opens the five difficulties');
  await page.screenshot({ path: out + '/02-ipad-play-menu.png' });
  await page.click('[data-diff="flash"]');
  await page.waitForFunction(() => window.__st.state.screen === 'game' && window.__st.state.game, null, { timeout: 15000 });
  await page.waitForTimeout(300);

  // Notes + undo on the first empty cell
  const first = await page.evaluate(() => window.__st.empties()[0]);
  check(!!first, 'flash puzzle has empty cells');
  await page.click('.cell[data-i="' + first.i + '"]');
  await page.click('#btn-pencil');
  await page.click('.pad .tile[data-n="1"]');
  await page.click('.pad .tile[data-n="2"]');
  const notesOn = await page.evaluate((i) => window.__st.state.game.notes[i] !== 0, first.i);
  check(notesOn, 'notes mode writes pencil marks into a cell');
  await page.screenshot({ path: out + '/03-ipad-notes.png' });
  await page.click('#btn-undo');
  await page.click('#btn-undo');
  const notesCleared = await page.evaluate((i) => window.__st.state.game.notes[i] === 0, first.i);
  check(notesCleared, 'undo removes notes');
  await page.click('#btn-pencil'); // leave notes mode
  check(await page.evaluate(() => window.__st.state.game.notesMode) === false, 'pencil toggles off');

  // Auto-remove notes: put a note of the solution number in a peer cell, then place it
  const peerNote = await page.evaluate((i) => {
    const g = window.__st.state.game;
    const n = g.solution[i];
    const peer = window.ST_PUZZLE.PEERS[i].find((p) => !g.grid[p] && p !== i);
    return { n, peer };
  }, first.i);
  if (peerNote.peer != null) {
    await page.evaluate(({p, n}) => { window.__st.state.game.notesMode = true; }, { p: peerNote.peer, n: peerNote.n });
    await page.click('.cell[data-i="' + peerNote.peer + '"]');
    await page.click('.pad .tile[data-n="' + peerNote.n + '"]');
    await page.evaluate(() => { window.__st.state.game.notesMode = false; window.__st.renderGame(); });
    await page.click('.cell[data-i="' + first.i + '"]');
    await page.click('.pad .tile[data-n="' + peerNote.n + '"]');
    const cleared = await page.evaluate(({p, n}) => (window.__st.state.game.notes[p] & window.ST_PUZZLE.bit(n)) === 0, { p: peerNote.peer, n: peerNote.n });
    check(cleared, 'placing a number clears that note from a peer cell');
    // undo the placement and the leftover note so the win path is clean
    await page.click('#btn-undo');
    await page.click('#btn-undo');
  } else {
    check(false, 'could not find a peer cell for the notes-clear test');
  }

  // Play the rest of the Flash board by tapping cell then number
  await page.evaluate(() => { const g = window.__st.state.game; g.selectedNum = 0; g.selectedCell = -1; g.notesMode = false; window.__st.renderGame(); });
  let empties = await page.evaluate(() => window.__st.empties().filter((e) => !e.cur));
  for (const e of empties) {
    await page.click('.cell[data-i="' + e.i + '"]');
    await page.click('.pad .tile[data-n="' + e.n + '"]');
  }
  await page.waitForFunction(() => window.__st.state.game && window.__st.state.game.won, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  check(await page.evaluate(() => window.__st.save.stats.gamesPlayed) === 1, 'win increments games played');
  check(await page.evaluate(() => window.__st.save.stats.perfectGames) === 1, 'zero-mistake flash counts as a perfect game');
  check(await page.isVisible('#overlay') && !(await page.evaluate(() => document.getElementById('overlay').classList.contains('hidden'))), 'win card is shown');
  await page.screenshot({ path: out + '/04-ipad-flash-win.png' });

  await page.click('#m-actions button.ghost'); // Menu
  await page.waitForTimeout(300);
  await page.click('[data-act="stats"]');
  await page.waitForTimeout(250);
  check(await page.evaluate(() => window.__st.state.screen) === 'stats', 'stats screen opens');
  const statsText = await page.evaluate(() => document.getElementById('stats-body').innerText);
  check(/games played/i.test(statsText) && /perfect/i.test(statsText), 'stats lists games played and perfect games');
  await page.screenshot({ path: out + '/05-ipad-stats.png' });

  // Reset confirm
  await page.click('#btn-reset-stats');
  await page.waitForTimeout(200);
  check(await page.isVisible('#overlay'), 'reset asks for confirmation');
  await page.click('#m-actions button.ghost'); // cancel
  check(await page.evaluate(() => window.__st.save.stats.gamesPlayed) === 1, 'cancel leaves stats in place');
  await page.click('#screen-stats .go-title');
  await page.waitForTimeout(200);

  // Options + look change
  await page.click('[data-act="options"]');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__st.state.screen) === 'options', 'options screen opens');
  await page.screenshot({ path: out + '/06-ipad-options.png' });
  await page.click('#screen-options .go-title');

  // 2. Mid-game highlights in portrait, then landscape
  await page.click('[data-act="play"]');
  await page.click('[data-diff="flash"]');
  await page.waitForFunction(() => window.__st.state.screen === 'game' && window.__st.state.game, null, { timeout: 15000 });
  // Confirm leaving? If a won game was cleared, there may be no in-progress game.
  if (await page.evaluate(() => !document.getElementById('overlay').classList.contains('hidden'))) {
    const labels = await page.evaluate(() => Array.from(document.querySelectorAll('#m-actions button')).map((b) => b.textContent));
    const ok = labels.find((t) => /New/i.test(t));
    if (ok) await page.click('#m-actions button:not(.ghost)');
    else await page.click('#m-actions button');
    await page.waitForFunction(() => window.__st.state.screen === 'game' && window.__st.state.game, null, { timeout: 15000 });
  }
  await page.waitForTimeout(200);
  // Select a given number so same-number cells glow
  const glow = await page.evaluate(() => {
    const g = window.__st.state.game;
    const i = [...g.clues].findIndex((v) => v);
    return { i, n: g.clues[i] };
  });
  await page.click('.cell[data-i="' + glow.i + '"]');
  await page.waitForTimeout(200);
  const glowCount = await page.evaluate(() => document.querySelectorAll('.cell.glow').length);
  check(glowCount >= 1, 'selecting a number outlines matching cells in green (got ' + glowCount + ')');
  await page.screenshot({ path: out + '/07-ipad-portrait-highlights.png' });

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(400);
  const landscapePad = await page.evaluate(() => {
    const pad = document.getElementById('pad').getBoundingClientRect();
    const board = document.getElementById('board').getBoundingClientRect();
    return { padX: pad.x, boardR: board.right, padVertical: pad.height > pad.width };
  });
  check(landscapePad.padX >= landscapePad.boardR - 8, 'landscape puts number tiles to the right of the board');
  await page.screenshot({ path: out + '/08-ipad-landscape-highlights.png' });
  await ctx.close();

  // 3. Phone title + a short game view
  ctx = await browser.newContext(PHONE);
  page = await ctx.newPage();
  watch(page);
  await page.goto(base);
  await ready(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/09-phone-title.png' });
  await page.click('[data-act="play"]');
  await page.click('[data-diff="easy"]');
  if (await page.evaluate(() => !document.getElementById('overlay').classList.contains('hidden'))) {
    await page.click('#m-actions button:not(.ghost)');
  }
  await page.waitForFunction(() => window.__st.state.screen === 'game' && window.__st.state.game, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const phoneFit = await page.evaluate(() => {
    const b = document.getElementById('board').getBoundingClientRect();
    const pad = document.getElementById('pad').getBoundingClientRect();
    return b.width > 200 && b.bottom <= pad.top + 4 && b.right <= innerWidth + 2 && pad.bottom <= innerHeight + 8;
  });
  check(phoneFit, 'phone layout keeps the board and number tiles on screen');
  await page.screenshot({ path: out + '/10-phone-game.png' });
  await ctx.close();

  // Landscape-only fresh visit of the title
  ctx = await browser.newContext(IPAD_L);
  page = await ctx.newPage();
  watch(page);
  await page.goto(base + '?reset=1');
  await ready(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/11-ipad-landscape-title.png' });
  await ctx.close();

  const realErr = consoleErr.filter((e) => !/Failed to load resource/i.test(e) && !/favicon/i.test(e));
  check(realErr.length === 0, 'no console errors' + (realErr.length ? ': ' + realErr.slice(0, 4).join(' | ') : ''));

  await browser.close();
  console.log(log.join('\n'));
  if (errors.length) { console.log(errors.length + ' failed'); process.exit(1); }
  else console.log('all e2e checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
