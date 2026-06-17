/** @typedef {number[][]} Grid */

/**
 * Deep-clone a 9×9 grid.
 * @param {Grid} grid
 * @returns {Grid}
 */
export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

/**
 * Check whether placing `num` at (row, col) is valid on `grid`.
 * @param {Grid} grid
 * @param {number} row
 * @param {number} col
 * @param {number} num
 */
export function isValidPlacement(grid, row, col, num) {
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

/**
 * Solve a Sudoku via backtracking. Mutates `grid` in place.
 * @param {Grid} grid
 * @returns {boolean}
 */
export function solve(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) continue;

      for (let num = 1; num <= 9; num++) {
        if (!isValidPlacement(grid, row, col, num)) continue;
        grid[row][col] = num;
        if (solve(grid)) return true;
        grid[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

/**
 * Return positions where the player's entry disagrees with the solution.
 * Only checks cells that were filled in the original puzzle (non-zero).
 * @param {Grid} puzzle
 * @param {Grid} solution
 * @returns {{ row: number, col: number }[]}
 */
export function findMistakes(puzzle, solution) {
  /** @type {{ row: number, col: number }[]} */
  const mistakes = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = puzzle[row][col];
      if (value !== 0 && value !== solution[row][col]) {
        mistakes.push({ row, col });
      }
    }
  }
  return mistakes;
}

/**
 * @param {Grid} puzzle
 * @returns {boolean}
 */
export function allEntriesCorrect(puzzle, solution) {
  return findMistakes(puzzle, solution).length === 0;
}

/**
 * Cells that are still empty in the puzzle.
 * @param {Grid} puzzle
 * @returns {{ row: number, col: number }[]}
 */
export function getEmptyCells(puzzle) {
  /** @type {{ row: number, col: number }[]} */
  const empty = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (puzzle[row][col] === 0) empty.push({ row, col });
    }
  }
  return empty;
}

/**
 * Pick `count` random distinct empty cells and return their solution values.
 * @param {Grid} puzzle
 * @param {Grid} solution
 * @param {number} count
 * @returns {{ row: number, col: number, value: number }[]}
 */
export function pickClues(puzzle, solution, count) {
  const empty = getEmptyCells(puzzle);
  if (empty.length === 0) return [];

  const shuffled = [...empty].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));

  return picked.map(({ row, col }) => ({
    row,
    col,
    value: solution[row][col],
  }));
}

/**
 * Validate that a grid has no internal conflicts among given (non-zero) cells.
 * @param {Grid} grid
 * @returns {boolean}
 */
export function hasConflicts(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const num = grid[row][col];
      if (num === 0) continue;
      grid[row][col] = 0;
      if (!isValidPlacement(grid, row, col, num)) {
        grid[row][col] = num;
        return true;
      }
      grid[row][col] = num;
    }
  }
  return false;
}

/**
 * Count filled cells in a grid.
 * @param {Grid} grid
 */
export function filledCount(grid) {
  let count = 0;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) count++;
    }
  }
  return count;
}

/**
 * Create an empty 9×9 grid.
 * @returns {Grid}
 */
export function emptyGrid() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}
