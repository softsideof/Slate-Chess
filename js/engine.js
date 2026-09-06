/**
 * Chess Studio - Stockfish UCI Engine Controller & Local Fallback
 * Manages in-browser Stockfish Web Worker execution, UCI command protocol,
 * normalized evaluation scores (strictly White perspective), and fallback
 * to LocalChessAI when workers are restricted.
 */
class EngineManager {
    constructor() {
        this.worker = null;
        this.isStockfishReady = false;
        this.isCalculating = false;
        this.localAI = new LocalChessAI();
        this.onEvalUpdate = null;
        this.onBestMove = null;
        this.currentFen = '';
        this.evalTurn = 'w';
        this.skillLevel = 10;
        this.searchDepth = 12;
        this.localDepth = 2;
    }

    init() {
        const sfUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

        const setupWorker = (w) => {
            this.worker = w;
            this.worker.onmessage = (e) => this.handleUciMessage(e.data);
            this.worker.onerror = () => { this.isStockfishReady = false; };
            this.worker.postMessage('uci');
            this.worker.postMessage('isready');
            this.worker.postMessage('ucinewgame');
            this.isStockfishReady = true;
        };

        // Try fetching script and creating Blob Worker to avoid cross-origin restrictions cleanly
        fetch(sfUrl)
            .then(r => r.text())
            .then(code => {
                const blob = new Blob([code], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                setupWorker(new Worker(blobUrl));
            })
            .catch(() => {
                try {
                    setupWorker(new Worker(sfUrl));
                } catch (e) {
                    this.isStockfishReady = false;
                }
            });
    }

    setDifficulty(tier) {
        const tiers = {
            '1': { skill: 0, depth: 4, localDepth: 1, label: 'Lvl 1 · 800' },
            '2': { skill: 3, depth: 6, localDepth: 2, label: 'Lvl 2 · 1100' },
            '3': { skill: 6, depth: 8, localDepth: 2, label: 'Lvl 3 · 1400' },
            '4': { skill: 10, depth: 10, localDepth: 3, label: 'Lvl 4 · 1700' },
            '5': { skill: 14, depth: 12, localDepth: 3, label: 'Lvl 5 · 2000' },
            '6': { skill: 17, depth: 14, localDepth: 3, label: 'Lvl 6 · 2300' },
            '7': { skill: 19, depth: 16, localDepth: 4, label: 'Lvl 7 · 2600' },
            '8': { skill: 20, depth: 18, localDepth: 4, label: 'Lvl 8 · 3200+' }
        };
        const conf = tiers[tier] || tiers['4'];
        this.skillLevel = conf.skill;
        this.searchDepth = conf.depth;
        this.localDepth = conf.localDepth;

        if (this.worker && this.isStockfishReady) {
            this.worker.postMessage(`setoption name Skill Level value ${this.skillLevel}`);
        }
        return conf.label;
    }

    startEvaluation(fen) {
        this.currentFen = fen;
        const parts = fen.split(' ');
        this.evalTurn = parts[1] || 'w';

        if (this.worker && this.isStockfishReady) {
            this.worker.postMessage('stop');
            this.worker.postMessage(`position fen ${fen}`);
            this.worker.postMessage(`go depth ${this.searchDepth}`);
        } else {
            // Accurate immediate fallback evaluation
            try {
                const tempGame = new Chess(fen);
                const res = this.localAI.getBestMove(tempGame, this.localDepth || 2);
                if (res && this.onEvalUpdate) {
                    const whiteScore = res.score / 100.0;
                    const uci = res.move ? (res.move.from + res.move.to + (res.move.promotion || '')) : '';
                    this.onEvalUpdate(whiteScore, null, this.localDepth, uci, uci);
                }
            } catch (e) {}
        }
    }

    calculateMove(fen, gameObj, callback, isHint = false) {
        this.isCalculating = true;
        this.currentFen = fen;
        const parts = fen.split(' ');
        this.evalTurn = parts[1] || 'w';

        if (this.worker && this.isStockfishReady) {
            this.onBestMove = (bestMove) => {
                this.isCalculating = false;
                callback(bestMove);
            };
            this.worker.postMessage('stop');
            this.worker.postMessage(`position fen ${fen}`);
            const movetime = isHint ? 700 : Math.min(1000, 120 + this.skillLevel * 45);
            this.worker.postMessage(`go depth ${this.searchDepth} movetime ${movetime}`);
        } else {
            setTimeout(() => {
                const res = this.localAI.getBestMove(gameObj, this.localDepth || 2);
                this.isCalculating = false;
                if (res && res.move) {
                    const uci = res.move.from + res.move.to + (res.move.promotion || '');
                    if (this.onEvalUpdate) {
                        const whiteScore = res.score / 100.0;
                        this.onEvalUpdate(whiteScore, null, this.localDepth, uci, uci);
                    }
                    callback(uci);
                } else {
                    callback(null);
                }
            }, 200);
        }
    }

    handleUciMessage(line) {
        if (typeof line !== 'string') return;

        if (line.includes('score cp') || line.includes('score mate')) {
            const cpMatch = line.match(/score cp (-?\d+)/);
            const mateMatch = line.match(/score mate (-?\d+)/);
            const depthMatch = line.match(/depth (\d+)/);
            const pvMatch = line.match(/ pv (.+)/);

            const depth = depthMatch ? parseInt(depthMatch[1], 10) : this.searchDepth;
            const pv = pvMatch ? pvMatch[1] : '';
            const bestMove = pv.split(' ')[0] || '';

            // In Stockfish UCI, score is relative to side to move!
            // We normalize so that positive is ALWAYS White advantage!
            const isWhiteTurn = this.evalTurn === 'w';

            if (cpMatch && this.onEvalUpdate) {
                const rawCp = parseInt(cpMatch[1], 10);
                const whiteCp = isWhiteTurn ? rawCp : -rawCp;
                this.onEvalUpdate(whiteCp / 100.0, null, depth, bestMove, pv);
            } else if (mateMatch && this.onEvalUpdate) {
                const rawMate = parseInt(mateMatch[1], 10);
                const whiteMate = isWhiteTurn ? rawMate : -rawMate;
                this.onEvalUpdate(null, whiteMate, depth, bestMove, pv);
            }
        }

        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            const moveStr = parts[1];
            if (this.onBestMove) {
                const cb = this.onBestMove;
                this.onBestMove = null;
                cb(moveStr);
            }
        }
    }
}

// Expose globally & for modules
if (typeof window !== 'undefined') {
    window.EngineManager = EngineManager;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EngineManager };
}
