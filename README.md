# Sudoku Tiles

A cozy wooden-tile sudoku for the couch or the kitchen table. Fill the board, keep a run of perfect games, and pick a wood you like.

Play: https://pollisis.github.io/sudoku-tiles/

## How to play
- Fill every row, column and 3×3 box with the numbers 1 to 9.
- Tap a cell, then a number — or pick a number first and tap the cells you want it in.
- The pencil button writes small notes in a cell. Placing a number clears matching notes in its row, column and box.
- A wrong number turns red and counts as a mistake. There is no limit on mistakes. A **perfect game** is one finished with none at all.
- Undo takes back your last change. Restart deals a fresh puzzle of the same difficulty.
- **Flash** is a nearly full board, meant as a quick warm-up. Easy through Expert get steadily tougher.

Score is points for each correct number, multiplied by the difficulty, plus a time bonus when you finish and a perfect-game bonus if you made no mistakes. A “run” is how many perfect games in a row you’ve done at that difficulty.

## Files
- `config.js` name, scoring and other knobs
- `puzzle.js` generator, unique-solution check and technique grader
- `puzzles.js` pre-built bank of 50 puzzles in each difficulty
- `game.js` menus, play, stats, looks and saving; `audio.js` synthesized wooden clicks
- Static files, no build step. Bump `?v=` in index.html to bust caches.

## Tests
- `node tests/unit.js` bank, uniqueness and grading
- `CHROME=/usr/bin/google-chrome node tests/e2e.js http://127.0.0.1:8861/ screenshots` iPad and phone browser test
