/** @typedef {import('./sudoku.js').Grid} Grid */

const OCR_CELL_SIZE = 64;
const TEMPLATE_SIZE = 32;
const CELL_PADDING = 0.22;
const MATCH_THRESHOLD = 0.22;
const MATCH_MARGIN = 0.04;

/** @type {Record<number, Uint8Array[]> | null} */
let digitTemplates = null;

/**
 * Load an image file into an HTMLImageElement.
 * @param {File} file
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

/**
 * Draw the image onto a canvas scaled to fit maxWidth.
 * @param {HTMLImageElement} img
 * @param {number} maxWidth
 */
export function drawToCanvas(img, maxWidth = 600) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Update grid overlay inset percentage.
 * @param {HTMLElement} overlay
 * @param {number} insetPercent
 */
export function setGridInset(overlay, insetPercent) {
  overlay.style.inset = `${insetPercent}%`;
}

/**
 * Build reference bitmaps for digits 1–9.
 */
function ensureTemplates() {
  if (digitTemplates) return;

  digitTemplates = {};
  const fonts = [
    `700 ${Math.round(TEMPLATE_SIZE * 0.78)}px "Helvetica Neue", Arial, sans-serif`,
    `700 ${Math.round(TEMPLATE_SIZE * 0.76)}px Georgia, "Times New Roman", serif`,
  ];

  for (let digit = 1; digit <= 9; digit++) {
    digitTemplates[digit] = fonts.map((font) => {
      const canvas = document.createElement("canvas");
      canvas.width = TEMPLATE_SIZE;
      canvas.height = TEMPLATE_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
      ctx.fillStyle = "#000000";
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(digit), TEMPLATE_SIZE / 2, TEMPLATE_SIZE / 2 + 1);
      return normalizeBits(toBinary(canvas), TEMPLATE_SIZE);
    });
  }
}

/**
 * Extract a raw cell canvas from the source image.
 * @param {HTMLCanvasElement} source
 * @param {number} row
 * @param {number} col
 * @param {number} insetPercent
 */
function extractCellRaw(source, row, col, insetPercent) {
  const inset = insetPercent / 100;
  const gridLeft = source.width * inset;
  const gridTop = source.height * inset;
  const gridWidth = source.width * (1 - 2 * inset);
  const gridHeight = source.height * (1 - 2 * inset);
  const cellWidth = gridWidth / 9;
  const cellHeight = gridHeight / 9;

  const sx = gridLeft + col * cellWidth + cellWidth * CELL_PADDING;
  const sy = gridTop + row * cellHeight + cellHeight * CELL_PADDING;
  const sw = cellWidth * (1 - 2 * CELL_PADDING);
  const sh = cellHeight * (1 - 2 * CELL_PADDING);

  const cellCanvas = document.createElement("canvas");
  cellCanvas.width = OCR_CELL_SIZE;
  cellCanvas.height = OCR_CELL_SIZE;
  const ctx = cellCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, OCR_CELL_SIZE, OCR_CELL_SIZE);
  return cellCanvas;
}

/**
 * Convert canvas to a binary bitmap (1 = ink).
 * @param {HTMLCanvasElement} canvas
 */
function toBinary(canvas) {
  const { data, width, height } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const bits = new Uint8Array(width * height);
  let sum = 0;

  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const mean = sum / (width * height);
  const threshold = mean < 110 ? mean + 35 : mean - 35;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const isDark = mean < 110 ? gray > threshold : gray < threshold;
    bits[p] = isDark ? 1 : 0;
  }

  return bits;
}

/**
 * @param {Uint8Array} bits
 * @param {number} size
 */
function inkRatio(bits, size) {
  let ink = 0;
  for (let i = 0; i < bits.length; i++) ink += bits[i];
  return ink / (size * size);
}

/**
 * Remove grid-line pixels connected to the cell border.
 * @param {Uint8Array} bits
 * @param {number} size
 */
function stripBorderInk(bits, size) {
  const cleaned = bits.slice();
  const visited = new Uint8Array(bits.length);
  /** @type {number[]} */
  const queue = [];

  for (let x = 0; x < size; x++) {
    queue.push(x, (size - 1) * size + x);
  }
  for (let y = 1; y < size - 1; y++) {
    queue.push(y * size, y * size + size - 1);
  }

  while (queue.length) {
    const idx = queue.pop();
    if (visited[idx] || !cleaned[idx]) continue;
    visited[idx] = 1;
    cleaned[idx] = 0;

    const x = idx % size;
    const y = (idx / size) | 0;
    if (x > 0) queue.push(idx - 1);
    if (x < size - 1) queue.push(idx + 1);
    if (y > 0) queue.push(idx - size);
    if (y < size - 1) queue.push(idx + size);
  }

  return cleaned;
}

/**
 * Crop ink to a square bounding box and scale to TEMPLATE_SIZE.
 * @param {Uint8Array} bits
 * @param {number} size
 */
function normalizeBits(bits, size) {
  let minX = size;
  let minY = size;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!bits[y * size + x]) continue;
      found = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!found) return new Uint8Array(TEMPLATE_SIZE * TEMPLATE_SIZE);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const pad = Math.round(Math.max(cropW, cropH) * 0.15);
  const box = Math.max(cropW, cropH) + pad * 2;
  const normalized = new Uint8Array(TEMPLATE_SIZE * TEMPLATE_SIZE);

  for (let ty = 0; ty < TEMPLATE_SIZE; ty++) {
    for (let tx = 0; tx < TEMPLATE_SIZE; tx++) {
      const sx = minX - pad + (tx + 0.5) * (box / TEMPLATE_SIZE);
      const sy = minY - pad + (ty + 0.5) * (box / TEMPLATE_SIZE);
      const ix = Math.min(size - 1, Math.max(0, Math.round(sx)));
      const iy = Math.min(size - 1, Math.max(0, Math.round(sy)));
      normalized[ty * TEMPLATE_SIZE + tx] = bits[iy * size + ix];
    }
  }

  return normalized;
}

/**
 * Score similarity between two equal-length binary arrays.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
function similarity(a, b) {
  let overlap = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union++;
    if (a[i] && b[i]) overlap++;
  }
  if (union === 0) return 0;
  return overlap / union;
}

/**
 * Match a normalized cell bitmap against digit templates.
 * @param {Uint8Array} normalized
 */
function matchDigit(normalized) {
  ensureTemplates();

  /** @type {{ digit: number, score: number }[]} */
  const ranked = [];

  for (let digit = 1; digit <= 9; digit++) {
    let bestVariant = 0;
    for (const template of digitTemplates[digit]) {
      bestVariant = Math.max(bestVariant, similarity(normalized, template));
    }
    ranked.push({ digit, score: bestVariant });
  }

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];

  if (best.score < MATCH_THRESHOLD) return 0;
  if (second && best.score - second.score < MATCH_MARGIN) return 0;
  return best.digit;
}

/**
 * Recognise a single digit from a grid cell in the source image.
 * @param {HTMLCanvasElement} source
 * @param {number} row
 * @param {number} col
 * @param {number} insetPercent
 */
function recognizeCell(source, row, col, insetPercent) {
  const raw = extractCellRaw(source, row, col, insetPercent);
  const bits = stripBorderInk(toBinary(raw), OCR_CELL_SIZE);

  if (inkRatio(bits, OCR_CELL_SIZE) < 0.015) return 0;

  const normalized = normalizeBits(bits, OCR_CELL_SIZE);
  if (inkRatio(normalized, TEMPLATE_SIZE) < 0.02) return 0;

  return matchDigit(normalized);
}

/**
 * Read a 9×9 Sudoku grid from a photo canvas.
 * Mutates `grid` in place so callers can refresh the UI during scanning.
 * @param {HTMLCanvasElement} source
 * @param {number} insetPercent
 * @param {Grid} grid
 * @param {(progress: number) => void} [onProgress]
 * @param {() => void} [onCell]
 */
export async function readGridFromCanvas(source, insetPercent, grid, onProgress, onCell) {
  ensureTemplates();
  const total = 81;
  let done = 0;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      grid[row][col] = recognizeCell(source, row, col, insetPercent);
      done++;
      onCell?.();
      onProgress?.(done / total);

      if (done % 9 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }
}

/** @deprecated Worker-based OCR removed; kept for API compatibility. */
export async function terminateOcr() {}
