import {
  cloneGrid,
  solve,
  findMistakes,
  allEntriesCorrect,
  pickClues,
  hasConflicts,
  emptyGrid,
  filledCount,
} from "./sudoku.js";
import { readGridFromCanvas } from "./ocr.js";
import { CropEditor } from "./crop-editor.js";

/** @typedef {import('./sudoku.js').Grid} Grid */

/** @type {Grid} */
let originalPuzzle = emptyGrid();
/** @type {Grid} */
let solution = emptyGrid();
/** @type {Set<string>} */
let clueCells = new Set();
let finished = false;
let reviewEditCell = null;

/** @type {CropEditor | null} */
let cropEditor = null;
/** @type {string | null} */
let cropObjectUrl = null;
let isProcessing = false;
let photoSessionId = 0;

const screens = {
  capture: document.getElementById("screen-capture"),
  processing: document.getElementById("screen-processing"),
  review: document.getElementById("screen-review"),
  game: document.getElementById("screen-game"),
};

const photoInput = document.getElementById("photo-input");
const processingMessage = document.getElementById("processing-message");
const cropImage = /** @type {HTMLImageElement} */ (document.getElementById("crop-image"));
const rotateSlider = /** @type {HTMLInputElement} */ (document.getElementById("rotate-slider"));
const rotateValue = document.getElementById("rotate-value");
const reviewGridEl = document.getElementById("review-grid");
const gameGridEl = document.getElementById("game-grid");
const statusBanner = document.getElementById("status-banner");
const actionPanel = document.getElementById("action-panel");
const reviewStatusEl = document.getElementById("review-status");
const numberPicker = /** @type {HTMLDialogElement} */ (document.getElementById("number-picker"));

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    const active = key === name;
    el.classList.toggle("active", active);
    el.hidden = !active;
  });
}

function clearGridElements() {
  reviewGridEl.replaceChildren();
  gameGridEl.replaceChildren();
}

function cellKey(row, col) {
  return `${row},${col}`;
}

/**
 * Build a sudoku grid DOM element.
 * @param {HTMLElement} container
 * @param {Grid} grid
 * @param {object} options
 */
function renderGrid(container, grid, options = {}) {
  const {
    editable = false,
    mistakes = [],
    clues = clueCells,
    isFinished = finished,
  } = options;

  const mistakeSet = new Set(mistakes.map(({ row, col }) => cellKey(row, col)));

  container.innerHTML = "";
  container.classList.toggle("editable", editable);

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = grid[row][col];
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("role", "gridcell");

      const key = cellKey(row, col);
      const isOriginal = editable ? value !== 0 : originalPuzzle[row][col] !== 0;
      const isClue = clues.has(key);
      const isRevealed = clues.has(key) || isFinished;

      if (value === 0) {
        cell.classList.add("empty");
        cell.textContent = "";
      } else {
        cell.textContent = String(value);
      }

      if (isOriginal && !mistakeSet.has(key)) {
        cell.classList.add("given");
      }
      if (mistakeSet.has(key)) {
        cell.classList.add("error");
      }
      if (isClue && !isOriginal) {
        cell.classList.add("clue");
      }
      if (isRevealed && !isOriginal && !mistakeSet.has(key)) {
        cell.classList.add("revealed");
      }

      if (editable) {
        cell.addEventListener("click", () => openPicker(row, col));
      }

      container.appendChild(cell);
    }
  }
}

function openPicker(row, col) {
  reviewEditCell = { row, col };
  numberPicker.showModal();
}

function closePicker() {
  reviewEditCell = null;
  numberPicker.close();
}

/** @type {Grid} */
let reviewGrid = emptyGrid();

function renderReviewGrid() {
  renderGrid(reviewGridEl, reviewGrid, { editable: true });
  updateReviewStatus();
}

function updateReviewStatus() {
  if (!reviewStatusEl) return;
  if (isProcessing) return;
  const count = filledCount(reviewGrid);
  if (count === 0) {
    reviewStatusEl.textContent =
      "No numbers detected yet. Adjust the crop or rotation, tap Re-read Grid, or enter digits manually.";
    reviewStatusEl.className = "review-status warning";
    return;
  }
  reviewStatusEl.textContent = `Detected ${count} number${count === 1 ? "" : "s"}. Tap any cell to correct a misread.`;
  reviewStatusEl.className = "review-status";
}

function destroyCropEditor() {
  cropEditor?.destroy();
  cropEditor = null;
  if (cropObjectUrl) {
    URL.revokeObjectURL(cropObjectUrl);
    cropObjectUrl = null;
  }
  cropImage.removeAttribute("src");
}

function resetGameState() {
  originalPuzzle = emptyGrid();
  solution = emptyGrid();
  reviewGrid = emptyGrid();
  clueCells = new Set();
  finished = false;
  reviewEditCell = null;
  closePicker();
  clearGridElements();
  destroyCropEditor();
}

function setRotation(degrees) {
  const clamped = Math.max(-45, Math.min(45, degrees));
  cropEditor?.rotateTo(clamped);
  rotateSlider.value = String(clamped);
  rotateValue.textContent = `${clamped.toFixed(1)}°`;
}

function openPhotoPicker() {
  photoInput.value = "";
  photoInput.click();
}

/**
 * @param {File} file
 * @param {number} session
 */
async function setupCropEditor(file, session) {
  destroyCropEditor();

  cropObjectUrl = URL.createObjectURL(file);
  cropImage.src = cropObjectUrl;
  await cropImage.decode();
  if (session !== photoSessionId) return;

  cropEditor = new CropEditor();
  await cropEditor.mount(cropImage);
  if (session !== photoSessionId) return;

  setRotation(0);
}

function getCroppedCanvas() {
  return cropEditor?.getCroppedCanvas(900) ?? null;
}

async function handlePhoto(file) {
  if (isProcessing) return;

  const session = ++photoSessionId;
  isProcessing = true;

  resetGameState();
  showScreen("processing");
  processingMessage.textContent = "Loading image…";

  try {
    showScreen("review");
    await setupCropEditor(file, session);
    if (session !== photoSessionId) return;

    await runOcr(session);
  } catch {
    if (session !== photoSessionId) return;
    processingMessage.textContent = "Could not read the image. Please try again.";
    showScreen("processing");
    setTimeout(() => {
      if (session !== photoSessionId) return;
      showScreen("capture");
    }, 2000);
  } finally {
    if (session === photoSessionId) {
      isProcessing = false;
      updateReviewStatus();
    }
  }
}

async function runOcr(session = photoSessionId) {
  const canvas = getCroppedCanvas();
  if (!canvas) {
    showScreen("capture");
    return;
  }

  reviewGrid = emptyGrid();
  reviewStatusEl.textContent = "Reading digits… 0%";
  reviewStatusEl.className = "review-status";
  renderReviewGrid();

  let cellsRead = 0;

  try {
    await readGridFromCanvas(
      canvas,
      0,
      reviewGrid,
      (progress) => {
        if (session !== photoSessionId) return;
        reviewStatusEl.textContent = `Reading digits… ${Math.round(progress * 100)}%`;
      },
      () => {
        if (session !== photoSessionId) return;
        cellsRead++;
        if (cellsRead % 3 === 0 || cellsRead === 81) {
          renderGrid(reviewGridEl, reviewGrid, { editable: true });
          const found = filledCount(reviewGrid);
          reviewStatusEl.textContent = `Reading digits… ${Math.round((cellsRead / 81) * 100)}% (${found} found)`;
        }
      },
    );

    if (session !== photoSessionId) return;

    renderReviewGrid();
  } catch {
    if (session !== photoSessionId) return;
    renderReviewGrid();
    reviewStatusEl.textContent =
      "OCR failed. Adjust the crop or rotation and tap Re-read Grid, or enter digits manually.";
    reviewStatusEl.className = "review-status warning";
  }
}

function startGame() {
  originalPuzzle = cloneGrid(reviewGrid);

  const working = cloneGrid(reviewGrid);
  if (hasConflicts(working)) {
    alert("This puzzle has conflicting numbers. Please fix the grid before continuing.");
    return;
  }

  solution = cloneGrid(working);
  if (!solve(solution)) {
    alert("This puzzle cannot be solved. Please check the numbers and try again.");
    return;
  }

  clueCells = new Set();
  finished = false;

  updateGameView();
  showScreen("game");
}

function updateGameView() {
  const mistakes = findMistakes(originalPuzzle, solution);
  const allCorrect = allEntriesCorrect(originalPuzzle, solution);

  renderGrid(gameGridEl, getDisplayValues(), {
    mistakes,
    clues: clueCells,
    isFinished: finished,
  });

  statusBanner.className = "status-banner";

  if (finished) {
    statusBanner.classList.add("success");
    statusBanner.textContent = "Here's the complete solution!";
    actionPanel.hidden = true;
    return;
  }

  if (mistakes.length > 0) {
    statusBanner.classList.add("error");
    const count = mistakes.length;
    statusBanner.textContent =
      count === 1
        ? "1 mistake found — highlighted in red."
        : `${count} mistakes found — highlighted in red.`;
    actionPanel.hidden = true;
    return;
  }

  if (allCorrect) {
    statusBanner.classList.add("success");
    statusBanner.textContent = "Everything is correct so far!";
    actionPanel.hidden = false;
    return;
  }

  statusBanner.classList.add("neutral");
  statusBanner.textContent = "Checking your puzzle…";
  actionPanel.hidden = true;
}

/**
 * Merge puzzle, clues, and finish state into display values.
 * @returns {Grid}
 */
function getDisplayValues() {
  const grid = cloneGrid(originalPuzzle);

  for (const key of clueCells) {
    const [row, col] = key.split(",").map(Number);
    grid[row][col] = solution[row][col];
  }

  if (finished) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        grid[row][col] = solution[row][col];
      }
    }
  }

  return grid;
}

function applyClues(count) {
  if (finished) return;

  const mistakes = findMistakes(originalPuzzle, solution);
  if (mistakes.length > 0) return;

  const clues = pickClues(originalPuzzle, solution, count);
  for (const { row, col } of clues) {
    clueCells.add(cellKey(row, col));
  }

  updateGameView();
}

function finishGame() {
  finished = true;
  updateGameView();
}

function resetGame() {
  clueCells = new Set();
  finished = false;
  updateGameView();
}

function newPicture() {
  openPhotoPicker();
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (file) handlePhoto(file);
});

document.getElementById("btn-take-picture").addEventListener("click", openPhotoPicker);

rotateSlider.addEventListener("input", () => {
  setRotation(parseFloat(rotateSlider.value));
});

document.getElementById("btn-rotate-left").addEventListener("click", () => {
  setRotation(parseFloat(rotateSlider.value) - 0.5);
});

document.getElementById("btn-rotate-right").addEventListener("click", () => {
  setRotation(parseFloat(rotateSlider.value) + 0.5);
});

document.getElementById("btn-rotate-reset").addEventListener("click", () => {
  setRotation(0);
});

document.getElementById("btn-reprocess").addEventListener("click", async () => {
  if (isProcessing || !cropEditor) return;
  isProcessing = true;
  const session = photoSessionId;
  try {
    await runOcr(session);
  } finally {
    if (session === photoSessionId) {
      isProcessing = false;
      updateReviewStatus();
    }
  }
});
document.getElementById("btn-confirm-grid").addEventListener("click", startGame);
document.getElementById("btn-clue").addEventListener("click", () => applyClues(1));
document.getElementById("btn-double-clue").addEventListener("click", () => applyClues(2));
document.getElementById("btn-finish").addEventListener("click", finishGame);
document.getElementById("btn-reset").addEventListener("click", resetGame);
document.getElementById("btn-new-picture").addEventListener("click", newPicture);
document.getElementById("btn-review-new-picture").addEventListener("click", newPicture);

numberPicker.querySelectorAll(".picker-grid button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!reviewEditCell) return;
    const { row, col } = reviewEditCell;
    reviewGrid[row][col] = parseInt(btn.dataset.value, 10);
    renderReviewGrid();
    closePicker();
  });
});

document.getElementById("picker-cancel").addEventListener("click", closePicker);

showScreen("capture");
