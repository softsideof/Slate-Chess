# Chess Studio

A modern, minimalist, tournament-grade chess web application built with pure HTML, CSS, and JavaScript. Powered by the Stockfish AI engine, it features real-time position analysis, bespoke board aesthetics, procedural audio, and zero dependencies—designed to run standalone in any browser or deploy instantly to Vercel.

---

## Highlights

- **Zero Downloads & Zero Dependencies**: All 12 tournament-standard vector SVG pieces are embedded directly in the code. No images or packages to download, zero network latency, and razor-sharp on 4K/Retina displays.
- **Stockfish AI (In-Browser Web Worker)**: Runs directly in browser memory without installing any binaries or software on your machine.
- **Dual-Engine Architecture**: If Web Workers are restricted (e.g. running under strict `file:///` policies) or if you are offline, an embedded heuristic Negamax engine with Alpha-Beta pruning and Piece-Square Tables seamlessly takes over.
- **Live Game Analysis & Sandbox Mode**: Continuous position evaluation, standard chess sigmoid winning probability bar, best continuation arrows, and principal variation (PV) sequence.
- **Interactive Difficulty Slider**: Adjust AI strength mid-game from Level 1 (~800 ELO) to Level 8 (~3200+ ELO).
- **Rock-Solid AI vs AI with Play/Pause**: Watch computer vs computer matches with full pause/resume control.
- **Procedural Sound Engine**: Synthesized on-the-fly using the native Web Audio API (tactile wooden taps, capture thuds, check alerts, and victory fanfares).
- **Vercel & Netlify Ready**: Single-file architecture ready for instant deployment with zero build steps or configuration.

---

## Features

### 1. Game Modes
- **White vs Computer**: Play as White against Stockfish.
- **Black vs Computer**: Play as Black with automatic board orientation flip.
- **Play vs Friend**: Local pass & play on the same screen.
- **Analysis & Sandbox**: Free move experimentation for both sides with live Stockfish evaluation and best move suggestions.
- **Computer vs Computer**: Watch AI self-play with an interactive `⏸ Pause` / `▶ Resume` control.

### 2. Live Analysis & Accurate Evaluation
- **Standard Sigmoid Winning Probability**:
  $$\text{Win Probability} = \frac{1}{1 + 10^{-\frac{\text{score}}{4}}}$$
- **Real-Time Evaluation Gauge**: Slender vertical bar showing pawn advantage (`+1.45`, `-0.80`, or forced mates `+M3`).
- **Hint Arrows**: Visual SVG arrow pointing to the optimal move.
- **Principal Variation**: Shows the predicted sequence of optimal moves.

### 3. Bespoke Board Aesthetics (Minimalist & Desaturated)
- **Nordic Slate (Default)**: Architectural warm linen (`#dfded8`) paired with deep muted graphite slate (`#4b5563`).
- **Monochrome Studio**: Minimal alabaster (`#eaeaea`) and matte charcoal (`#2c2f38`).
- **Warm Cedar**: Natural cedar wood tones (`#ded7cb`) and muted espresso walnut (`#5e534b`).
- **Titanium**: Cool industrial zinc (`#d6dbe3`) and midnight navy (`#3b4554`).

### 4. Tournament Clocks & History
- **Time Controls**: Bullet (1m), Blitz (3m, 5m), Rapid (10m, 15|10), or Casual (Unlimited).
- **Move History Log**: Algebraic notation with step-through replay buttons (`|<`, `<`, `>`, `>|`).
- **Captured Pieces & Material Counter**: Visual trays for captured pieces with score difference badge (`+3`).
- **Pawn Promotion Modal**: Select Queen, Rook, Bishop, or Knight with crisp SVG icons.
- **One-Click Export**: Copy PGN or Copy FEN to clipboard.

---

## How to Run

### Option 1: Direct Double-Click (Offline)
Double-click `chess.html` or `index.html` in your file explorer. It opens directly in Google Chrome, Edge, Safari, or Firefox without any setup.

### Option 2: Local HTTP Server
Run a quick local server using Python:
```bash
# In the project directory
python -m http.server 8080
```
Then visit `http://localhost:8080` in your browser.

### Option 3: Deploy to Vercel (One-Click)
1. Push this folder to a GitHub repository.
2. Import the repository into [Vercel](https://vercel.com).
3. Leave all build settings default (Framework: **Other**, Build Command: empty).
4. Click **Deploy**. Vercel will serve `index.html` instantly at the root URL!

---

## Project Structure

```text
├── index.html     # Mirror entry point for Vercel/Netlify root serving
├── chess.html     # Primary standalone single-file chess application
└── README.md      # Project documentation
```

---

## Technology Stack

- **Markup**: Semantic HTML5 with accessible ARIA tags
- **Styling**: Vanilla CSS3 (Custom design system, glassmorphic dark palette, responsive flex/grid)
- **Rules Engine**: `chess.js` (Castling, En Passant, 3-fold repetition, 50-move rule, promotion)
- **AI Engine**: Stockfish 10 (via CDN Web Worker) + Heuristic Negamax Alpha-Beta Fallback
- **Audio**: Native Web Audio API procedural synthesis (Zero external audio files)
- **Graphics**: Pure SVG vector pieces embedded directly into code
- **Icons**: FontAwesome 6 CDN

---

## License

MIT License — Feel free to use, modify, and distribute for personal or commercial projects.
