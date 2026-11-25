// Sudoku Tiles — name, scoring and tuning. Bump VERSION and the ?v= query in index.html together.
window.ST = {
  NAME: 'Sudoku Tiles',
  VERSION: 1,
  STORAGE_KEY: 'sudoku-tiles-v1',

  DIFFICULTIES: ['flash', 'easy', 'medium', 'hard', 'expert'],
  LABELS: { flash: 'Flash', easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' },
  LOOKS: ['walnut', 'maple', 'cherry'],
  LOOK_LABELS: { walnut: 'Walnut', maple: 'Maple', cherry: 'Cherry' },

  // Scoring. Running score during play is cell points × difficulty.
  // Time bonus and perfect bonus are added when the board is finished.
  SCORING: {
    POINTS_PER_CELL: 10,
    DIFFICULTY_MULT: { flash: 1, easy: 1.5, medium: 2, hard: 3, expert: 4 },
    TIME_BONUS_MAX: { flash: 200, easy: 400, medium: 800, hard: 1500, expert: 2500 },
    TIME_TARGET_SEC: { flash: 60, easy: 180, medium: 360, hard: 600, expert: 900 },
    PERFECT_BONUS: { flash: 100, easy: 250, medium: 500, hard: 1000, expert: 2000 }
  },

  // Mini 3×3 icons on the stats page: more dark squares means easier.
  STAT_ICONS: {
    flash:  [1,1,1, 1,1,1, 1,1,0],
    easy:   [1,1,1, 1,0,1, 1,1,0],
    medium: [1,0,1, 0,1,0, 1,0,1],
    hard:   [1,0,0, 0,1,0, 0,0,1],
    expert: [0,0,0, 0,1,0, 0,0,0]
  }
};
