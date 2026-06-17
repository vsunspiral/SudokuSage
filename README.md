# Sudoku Sage

A mobile-friendly web assistant for paper-based Sudoku puzzles. Scan your in-progress puzzle, check your entries, and get clues — without spoiling the whole grid.

**Live site:** [https://vsunspiral.github.io/SudokuSage/](https://vsunspiral.github.io/SudokuSage/)

## How it works

1. **Take a picture** of your paper Sudoku puzzle.
2. **Review the grid** — adjust the crop inset if needed and tap any misread cell to fix it.
3. **Check your puzzle** — the app solves it internally and highlights any mistakes in red (without revealing correct answers).
4. If everything is correct, choose from:
   - **Give me a clue** — reveals one random empty cell.
   - **Give me a double clue** — reveals two random empty cells.
   - **Finish the Game** — shows the complete solution.
5. Use **Reset** to hide clues and start over with the same puzzle, or **New Picture** to scan another.

## Tech

- Pure HTML, CSS, and JavaScript — no build step.
- [Tesseract.js](https://tesseract.projectnaptha.com/) for client-side OCR.
- Hosted on GitHub Pages.

## Local development

Serve the project root with any static file server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages setup

After pushing to `main`, enable GitHub Pages in your repo settings:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

The included workflow deploys automatically on every push to `main`.
