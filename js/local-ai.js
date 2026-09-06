/**
 * Chess Studio - Built-in Heuristic Chess Engine
 * Provides fast positional evaluations using Piece-Square Tables (PST)
 * and Alpha-Beta minimax search as a fallback when Web Workers are restricted.
 */
class LocalChessAI {
    constructor() {
        this.values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
        this.pst = {
            p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
            n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
            b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
            r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
            q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
            k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
        };
    }

    // Returns score strictly from WHITE's perspective (positive = White leads, negative = Black leads)
    evaluate(game) {
        if (game.in_checkmate()) {
            return game.turn() === 'w' ? -99999 : 99999;
        }
        if (game.in_draw() || game.in_stalemate()) return 0;

        let score = 0;
        const board = game.board();
        let whiteBishops = 0;
        let blackBishops = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (!p) continue;
                const val = this.values[p.type] || 0;
                const idx = p.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
                const posVal = this.pst[p.type] ? this.pst[p.type][idx] : 0;
                const itemScore = val + posVal;

                if (p.color === 'w') {
                    score += itemScore;
                    if (p.type === 'b') whiteBishops++;
                } else {
                    score -= itemScore;
                    if (p.type === 'b') blackBishops++;
                }
            }
        }

        // Bishop pair bonuses
        if (whiteBishops >= 2) score += 35;
        if (blackBishops >= 2) score -= 35;

        return score;
    }

    search(game, depth, alpha, beta, isMaximizing) {
        if (depth === 0 || game.game_over()) return this.evaluate(game);
        const moves = game.moves({ verbose: true });
        moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const m of moves) {
                game.move(m);
                const ev = this.search(game, depth - 1, alpha, beta, false);
                game.undo();
                maxEval = Math.max(maxEval, ev);
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const m of moves) {
                game.move(m);
                const ev = this.search(game, depth - 1, alpha, beta, true);
                game.undo();
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getBestMove(game, depth = 3) {
        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return null;
        const isWhite = game.turn() === 'w';
        let bestMove = moves[0];
        let bestScore = isWhite ? -Infinity : Infinity;

        for (const m of moves) {
            game.move(m);
            const score = this.search(game, depth - 1, -Infinity, Infinity, !isWhite);
            game.undo();
            if (isWhite && score > bestScore) {
                bestScore = score;
                bestMove = m;
            } else if (!isWhite && score < bestScore) {
                bestScore = score;
                bestMove = m;
            }
        }
        // bestScore is strictly from White's perspective (+ = White advantage)
        return { move: bestMove, score: bestScore };
    }
}

// Expose globally & for modules
if (typeof window !== 'undefined') {
    window.LocalChessAI = LocalChessAI;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LocalChessAI };
}
