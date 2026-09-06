/**
 * Chess Studio - Main Application Controller
 * Handles chessboard UI rendering, user interaction, drag & drop, move validation,
 * tournament clocks, move history stepper, evaluation displays, modals, and themes.
 */
(() => {
    'use strict';

    const PIECE_SVGS = (typeof window !== 'undefined' && window.PIECE_SVGS) ? window.PIECE_SVGS : {};

    class ChessApp {
        constructor() {
            this.game = new Chess();
            this.sounds = new SoundEngine();
            this.engine = new EngineManager();

            // UI references
            this.boardEl = document.getElementById('chessboard');
            this.evalGauge = document.getElementById('evalGauge');
            this.evalFill = document.getElementById('evalFill');
            this.evalTag = document.getElementById('evalTag');
            this.arrowOverlay = document.getElementById('arrowOverlay');
            this.statusMsgEl = document.getElementById('statusMsg');
            this.moveHistoryList = document.getElementById('moveHistoryList');
            this.dragAvatar = document.getElementById('dragAvatar');
            this.toastEl = document.getElementById('toast');
            this.playPauseBtn = document.getElementById('playPauseBtn');
            this.playPauseText = document.getElementById('playPauseText');

            // Game state
            this.mode = 'vs-ai-w';
            this.isFlipped = false;
            this.isPaused = false;
            this.isAiRunning = false;
            this.aiVsAiTimer = null;
            this.selectedSquare = null;
            this.legalMoves = [];
            this.historyStack = [];
            this.viewingPly = -1;
            this.pendingPromotion = null;

            // Clocks
            this.timeControlSeconds = 300;
            this.whiteTime = 300;
            this.blackTime = 300;
            this.clockTimer = null;

            this.initApp();
        }

        initApp() {
            this.engine.init();
            const slider = document.getElementById('aiSkillSlider');
            const badge = document.getElementById('sliderBadge');
            badge.textContent = this.engine.setDifficulty(slider.value);

            this.engine.onEvalUpdate = (whiteScore, whiteMateIn, depth, bestMove, pv) => {
                this.updateEvaluationUI(whiteScore, whiteMateIn, depth, bestMove, pv);
            };

            this.bindEvents();
            this.resetGame();
        }

        bindEvents() {
            // Stockfish Difficulty Slider
            const slider = document.getElementById('aiSkillSlider');
            const badge = document.getElementById('sliderBadge');
            slider.addEventListener('input', (e) => {
                const label = this.engine.setDifficulty(e.target.value);
                badge.textContent = label;
                this.showToast(`AI updated to ${label}`);
                this.engine.startEvaluation(this.game.fen());
            });

            // Tabs: Moves vs Analysis
            const tabMovesBtn = document.getElementById('tabMovesBtn');
            const tabAnalysisBtn = document.getElementById('tabAnalysisBtn');
            const tabContentMoves = document.getElementById('tabContentMoves');
            const tabContentAnalysis = document.getElementById('tabContentAnalysis');

            tabMovesBtn.addEventListener('click', () => {
                tabMovesBtn.classList.add('active');
                tabAnalysisBtn.classList.remove('active');
                tabContentMoves.style.display = 'flex';
                tabContentAnalysis.style.display = 'none';
            });

            tabAnalysisBtn.addEventListener('click', () => {
                tabAnalysisBtn.classList.add('active');
                tabMovesBtn.classList.remove('active');
                tabContentAnalysis.style.display = 'flex';
                tabContentMoves.style.display = 'none';
                this.engine.startEvaluation(this.game.fen());
            });

            // Mode Selector
            document.getElementById('modeSelect').addEventListener('change', (e) => {
                this.mode = e.target.value;
                this.isFlipped = (this.mode === 'vs-ai-b');
                this.resetGame();
            });

            // Play / Pause Button
            this.playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });

            // Time Control
            document.getElementById('timeControlSelect').addEventListener('change', (e) => {
                this.timeControlSeconds = parseInt(e.target.value, 10);
                this.resetGame();
            });

            // Theme Switcher
            document.getElementById('themeSelect').addEventListener('change', (e) => {
                document.body.className = e.target.value;
            });

            // Sound Toggle
            const soundBtn = document.getElementById('soundToggleBtn');
            soundBtn.addEventListener('click', () => {
                const on = this.sounds.toggle();
                soundBtn.innerHTML = on ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
                this.showToast(on ? 'Sound on' : 'Sound muted');
            });

            // Action Buttons
            document.getElementById('newGameBtn').addEventListener('click', () => this.resetGame());
            document.getElementById('modalNewGameBtn').addEventListener('click', () => {
                document.getElementById('gameOverModal').classList.remove('open');
                this.resetGame();
            });

            document.getElementById('flipBtn').addEventListener('click', () => {
                this.isFlipped = !this.isFlipped;
                this.renderBoard();
                this.clearHintArrow();
                // Keep eval gauge matching board orientation
                this.evalGauge.style.flexDirection = this.isFlipped ? 'column' : 'column-reverse';
            });

            document.getElementById('undoBtn').addEventListener('click', () => this.handleUndo());
            document.getElementById('resignBtn').addEventListener('click', () => this.handleResign());
            document.getElementById('hintBtn').addEventListener('click', () => this.requestHint());

            document.getElementById('copyPgnBtn').addEventListener('click', () => {
                navigator.clipboard.writeText(this.game.pgn()).then(() => this.showToast('PGN copied!'));
            });

            document.getElementById('copyFenBtn').addEventListener('click', () => {
                navigator.clipboard.writeText(this.game.fen()).then(() => this.showToast('FEN copied!'));
            });

            // Stepper
            document.getElementById('stepFirstBtn').addEventListener('click', () => this.seekHistory(0));
            document.getElementById('stepPrevBtn').addEventListener('click', () => this.seekHistory(this.viewingPly - 1));
            document.getElementById('stepNextBtn').addEventListener('click', () => this.seekHistory(this.viewingPly + 1));
            document.getElementById('stepLastBtn').addEventListener('click', () => this.seekHistory(-1));

            // Drag & Drop
            window.addEventListener('pointermove', (e) => {
                if (this.dragAvatar.style.display === 'block') {
                    this.dragAvatar.style.left = `${e.clientX}px`;
                    this.dragAvatar.style.top = `${e.clientY}px`;
                }
            });

            window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        }

        togglePlayPause() {
            this.isPaused = !this.isPaused;
            if (this.isPaused) {
                this.playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span id="playPauseText">Resume</span>';
                this.statusMsgEl.textContent = 'Game paused';
                clearTimeout(this.aiVsAiTimer);
            } else {
                this.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span id="playPauseText">Pause</span>';
                this.updateStatus();
                if (this.mode === 'ai-vs-ai') {
                    this.stepAiVsAi();
                } else if (this.isAIsTurn()) {
                    this.triggerSingleAiMove();
                }
            }
        }

        resetGame() {
            this.game.reset();
            this.selectedSquare = null;
            this.legalMoves = [];
            this.historyStack = [{ fen: this.game.fen(), lastMove: null }];
            this.viewingPly = -1;
            this.pendingPromotion = null;
            this.isPaused = false;
            this.isAiRunning = false;
            clearTimeout(this.aiVsAiTimer);
            this.clearHintArrow();

            this.playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span id="playPauseText">Pause</span>';
            this.evalGauge.style.flexDirection = this.isFlipped ? 'column' : 'column-reverse';

            this.whiteTime = this.timeControlSeconds;
            this.blackTime = this.timeControlSeconds;
            this.updateClockDisplays();
            this.startClock();

            this.updatePlayerLabels();
            this.renderBoard();
            this.renderMoveList();
            this.updateStatus();
            this.updateCapturedTrays();

            // Initial baseline evaluation
            this.updateEvaluationUI(0.0, null, 10, '', '');
            this.engine.startEvaluation(this.game.fen());

            if (this.mode === 'vs-ai-b') {
                this.triggerSingleAiMove();
            } else if (this.mode === 'ai-vs-ai') {
                this.stepAiVsAi();
            }
        }

        updatePlayerLabels() {
            const topName = document.getElementById('topPlayerName');
            const bottomName = document.getElementById('bottomPlayerName');
            const topDot = document.getElementById('topPlayerDot');
            const bottomDot = document.getElementById('bottomPlayerDot');

            topDot.className = `player-color-dot ${this.isFlipped ? 'dot-w' : 'dot-b'}`;
            bottomDot.className = `player-color-dot ${this.isFlipped ? 'dot-b' : 'dot-w'}`;

            if (this.mode === 'vs-ai-w') {
                topName.textContent = 'Computer';
                bottomName.textContent = 'You';
            } else if (this.mode === 'vs-ai-b') {
                topName.textContent = 'Computer';
                bottomName.textContent = 'You';
            } else if (this.mode === 'pass-play') {
                topName.textContent = this.isFlipped ? 'White' : 'Black';
                bottomName.textContent = this.isFlipped ? 'Black' : 'White';
            } else if (this.mode === 'analysis') {
                topName.textContent = 'Analysis Board';
                bottomName.textContent = 'Sandbox';
            } else {
                topName.textContent = this.isFlipped ? 'Computer (White)' : 'Computer (Black)';
                bottomName.textContent = this.isFlipped ? 'Computer (Black)' : 'Computer (White)';
            }
        }

        // Board Rendering
        renderBoard() {
            this.boardEl.innerHTML = '';
            const lastMove = this.getLastMove();
            const checkSquare = this.game.in_check() ? this.getKingSquare(this.game.turn()) : null;

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const rank = this.isFlipped ? r + 1 : 8 - r;
                    const fileIdx = this.isFlipped ? 7 - c : c;
                    const file = String.fromCharCode('a'.charCodeAt(0) + fileIdx);
                    const sq = file + rank;

                    const squareDiv = document.createElement('div');
                    squareDiv.className = `square ${ (r + c) % 2 === 0 ? 'light' : 'dark' }`;
                    squareDiv.dataset.square = sq;

                    if (c === 0) {
                        const num = document.createElement('span');
                        num.className = 'coord-num';
                        num.textContent = rank;
                        squareDiv.appendChild(num);
                    }
                    if (r === 7) {
                        const letter = document.createElement('span');
                        letter.className = 'coord-alpha';
                        letter.textContent = file;
                        squareDiv.appendChild(letter);
                    }

                    if (this.selectedSquare === sq) squareDiv.classList.add('selected');
                    if (lastMove && (lastMove.from === sq || lastMove.to === sq)) squareDiv.classList.add('last-move');
                    if (checkSquare === sq) squareDiv.classList.add('in-check');

                    const legal = this.legalMoves.find(m => m.to === sq);
                    if (legal) {
                        squareDiv.classList.add(legal.captured ? 'legal-capture' : 'legal-move');
                    }

                    const piece = this.game.get(sq);
                    if (piece) {
                        const pieceKey = piece.color + piece.type.toUpperCase();
                        const pieceWrap = document.createElement('div');
                        pieceWrap.className = 'piece-wrap';
                        pieceWrap.innerHTML = PIECE_SVGS[pieceKey] || '';
                        pieceWrap.dataset.square = sq;
                        squareDiv.appendChild(pieceWrap);

                        pieceWrap.addEventListener('pointerdown', (e) => this.handlePointerDown(e, sq, pieceKey));
                    }

                    squareDiv.addEventListener('click', () => this.handleSquareClick(sq));
                    this.boardEl.appendChild(squareDiv);
                }
            }
        }

        handleSquareClick(sq) {
            if (this.viewingPly !== -1) this.seekHistory(-1);
            if (this.isPaused || this.game.game_over()) return;
            if (this.mode !== 'analysis' && this.isAIsTurn()) return;

            if (this.selectedSquare) {
                const move = this.legalMoves.find(m => m.to === sq);
                if (move) {
                    this.attemptMove(this.selectedSquare, sq);
                    return;
                }
            }

            const piece = this.game.get(sq);
            const canSelect = piece && (this.mode === 'analysis' || piece.color === this.game.turn());
            if (canSelect && piece.color === this.game.turn()) {
                this.selectSquare(sq);
            } else {
                this.clearSelection();
            }
        }

        selectSquare(sq) {
            this.selectedSquare = sq;
            this.legalMoves = this.game.moves({ square: sq, verbose: true });
            this.clearHintArrow();
            this.renderBoard();
        }

        clearSelection() {
            this.selectedSquare = null;
            this.legalMoves = [];
            this.renderBoard();
        }

        // Drag and Drop
        handlePointerDown(e, sq, pieceKey) {
            if (this.isPaused || this.game.game_over() || this.viewingPly !== -1) return;
            if (this.mode !== 'analysis' && this.isAIsTurn()) return;
            const piece = this.game.get(sq);
            if (!piece || piece.color !== this.game.turn()) return;

            this.dragSourceSq = sq;
            this.selectSquare(sq);

            this.dragAvatar.innerHTML = PIECE_SVGS[pieceKey] || '';
            this.dragAvatar.style.display = 'block';
            this.dragAvatar.style.left = `${e.clientX}px`;
            this.dragAvatar.style.top = `${e.clientY}px`;

            e.currentTarget.classList.add('dragging');
        }

        handlePointerUp(e) {
            if (!this.dragSourceSq) return;
            this.dragAvatar.style.display = 'none';
            this.dragAvatar.innerHTML = '';

            const target = document.elementFromPoint(e.clientX, e.clientY);
            const squareEl = target ? target.closest('.square') : null;

            if (squareEl) {
                const destSq = squareEl.dataset.square;
                if (destSq && destSq !== this.dragSourceSq) {
                    const isLegal = this.legalMoves.some(m => m.to === destSq);
                    if (isLegal) {
                        this.attemptMove(this.dragSourceSq, destSq);
                        this.dragSourceSq = null;
                        return;
                    }
                }
            }

            this.dragSourceSq = null;
            this.renderBoard();
        }

        // Move Execution
        attemptMove(from, to) {
            const piece = this.game.get(from);
            const isPawn = piece && piece.type === 'p';
            const isPromotion = isPawn && (to[1] === '8' || to[1] === '1');

            if (isPromotion) {
                this.showPromotionModal(from, to, piece.color);
                return;
            }

            this.executeMove({ from, to });
        }

        executeMove(moveObj, autoTriggerAi = true) {
            const res = this.game.move(moveObj);
            if (!res) return false;

            if (this.game.in_check()) {
                this.sounds.playCheck();
            } else if (res.captured) {
                this.sounds.playCapture();
            } else {
                this.sounds.playMove();
            }

            this.historyStack.push({
                fen: this.game.fen(),
                lastMove: { from: res.from, to: res.to }
            });

            this.clearSelection();
            this.clearHintArrow();
            this.renderBoard();
            this.renderMoveList();
            this.updateCapturedTrays();
            this.updateStatus();

            // Continuous real-time evaluation
            this.engine.startEvaluation(this.game.fen());

            if (this.game.game_over()) {
                this.handleGameOver();
                return true;
            }

            if (autoTriggerAi && !this.isPaused) {
                if (this.mode.startsWith('vs-ai') && this.isAIsTurn()) {
                    this.triggerSingleAiMove();
                }
            }

            return true;
        }

        showPromotionModal(from, to, color) {
            this.pendingPromotion = { from, to };
            const modal = document.getElementById('promoModal');
            const tray = document.getElementById('promoChoices');
            tray.innerHTML = '';

            ['q', 'r', 'b', 'n'].forEach(p => {
                const key = color + p.toUpperCase();
                const btn = document.createElement('div');
                btn.className = 'promo-btn';
                btn.innerHTML = PIECE_SVGS[key] || '';
                btn.addEventListener('click', () => {
                    modal.classList.remove('open');
                    this.executeMove({ from: this.pendingPromotion.from, to: this.pendingPromotion.to, promotion: p });
                    this.pendingPromotion = null;
                });
                tray.appendChild(btn);
            });

            modal.classList.add('open');
        }

        // AI Moves
        triggerSingleAiMove() {
            if (this.isPaused || this.game.game_over()) return;
            this.statusMsgEl.textContent = 'Computer thinking...';

            this.engine.calculateMove(this.game.fen(), this.game, (bestMove) => {
                if (!bestMove || this.isPaused) return;
                const from = bestMove.substring(0, 2);
                const to = bestMove.substring(2, 4);
                const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

                this.executeMove({ from, to, promotion }, true);
            });
        }

        stepAiVsAi() {
            if (this.mode !== 'ai-vs-ai' || this.isPaused || this.game.game_over()) return;
            if (this.isAiRunning) return;

            this.isAiRunning = true;
            this.statusMsgEl.textContent = `${this.game.turn() === 'w' ? 'White' : 'Black'} thinking...`;

            this.engine.calculateMove(this.game.fen(), this.game, (bestMove) => {
                this.isAiRunning = false;
                if (!bestMove || this.mode !== 'ai-vs-ai' || this.isPaused) return;

                const from = bestMove.substring(0, 2);
                const to = bestMove.substring(2, 4);
                const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

                this.executeMove({ from, to, promotion }, false);

                if (!this.game.game_over() && !this.isPaused && this.mode === 'ai-vs-ai') {
                    this.aiVsAiTimer = setTimeout(() => this.stepAiVsAi(), 550);
                }
            });
        }

        isAIsTurn() {
            if (this.mode === 'pass-play' || this.mode === 'analysis') return false;
            if (this.mode === 'ai-vs-ai') return true;
            const turn = this.game.turn();
            return (this.mode === 'vs-ai-w' && turn === 'b') || (this.mode === 'vs-ai-b' && turn === 'w');
        }

        // Hints
        requestHint() {
            if (this.game.game_over()) return;
            this.showToast('Calculating best move...');
            this.engine.calculateMove(this.game.fen(), this.game, (bestMove) => {
                if (!bestMove) return;
                const from = bestMove.substring(0, 2);
                const to = bestMove.substring(2, 4);
                this.drawHintArrow(from, to);
                this.showToast(`Best Move: ${from} → ${to}`);
            }, true);
        }

        drawHintArrow(fromSq, toSq) {
            this.clearHintArrow();
            const from = this.getSquareCenter(fromSq);
            const to = this.getSquareCenter(toSq);
            if (!from || !to) return;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.x);
            line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);
            line.setAttribute('y2', to.y);
            line.setAttribute('stroke', 'rgba(255, 255, 255, 0.75)');
            line.setAttribute('stroke-width', '18');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('marker-end', 'url(#arrowHead)');

            this.arrowOverlay.appendChild(line);
        }

        clearHintArrow() {
            const lines = this.arrowOverlay.querySelectorAll('line');
            lines.forEach(l => l.remove());
        }

        getSquareCenter(sq) {
            const file = sq.charCodeAt(0) - 'a'.charCodeAt(0);
            const rank = parseInt(sq[1], 10);
            const col = this.isFlipped ? 7 - file : file;
            const row = this.isFlipped ? rank - 1 : 8 - rank;
            return { x: col * 100 + 50, y: row * 100 + 50 };
        }

        // Clocks
        startClock() {
            if (this.clockTimer) clearInterval(this.clockTimer);
            if (this.timeControlSeconds === 0 || this.mode === 'analysis') return;

            this.clockTimer = setInterval(() => {
                if (this.game.game_over() || this.isPaused) return;

                if (this.game.turn() === 'w') {
                    this.whiteTime = Math.max(0, this.whiteTime - 1);
                    if (this.whiteTime === 0) this.handleTimeout('w');
                } else {
                    this.blackTime = Math.max(0, this.blackTime - 1);
                    if (this.blackTime === 0) this.handleTimeout('b');
                }
                this.updateClockDisplays();
            }, 1000);
        }

        updateClockDisplays() {
            const topClock = document.getElementById('topClock');
            const bottomClock = document.getElementById('bottomClock');

            if (this.timeControlSeconds === 0 || this.mode === 'analysis') {
                topClock.textContent = '∞';
                bottomClock.textContent = '∞';
                return;
            }

            const fmt = (sec) => {
                const m = Math.floor(sec / 60).toString().padStart(2, '0');
                const s = (sec % 60).toString().padStart(2, '0');
                return `${m}:${s}`;
            };

            const isTopWhite = this.isFlipped;
            const topTime = isTopWhite ? this.whiteTime : this.blackTime;
            const bottomTime = isTopWhite ? this.blackTime : this.whiteTime;

            topClock.textContent = fmt(topTime);
            bottomClock.textContent = fmt(bottomTime);

            const turn = this.game.turn();
            topClock.classList.toggle('active', (isTopWhite && turn === 'w') || (!isTopWhite && turn === 'b'));
            bottomClock.classList.toggle('active', (!isTopWhite && turn === 'w') || (isTopWhite && turn === 'b'));

            topClock.classList.toggle('low-time', topTime < 25);
            bottomClock.classList.toggle('low-time', bottomTime < 25);
        }

        handleTimeout(player) {
            clearInterval(this.clockTimer);
            const winner = player === 'w' ? 'Black' : 'White';
            this.showGameOverModal(`${winner} won on time.`);
        }

        // Move List & History
        renderMoveList() {
            this.moveHistoryList.innerHTML = '';
            const history = this.game.history({ verbose: true });

            for (let i = 0; i < history.length; i += 2) {
                const moveNum = Math.floor(i / 2) + 1;
                const whiteMove = history[i];
                const blackMove = history[i + 1];

                const row = document.createElement('div');
                row.className = 'move-entry';

                const idxSpan = document.createElement('span');
                idxSpan.className = 'move-idx';
                idxSpan.textContent = `${moveNum}.`;
                row.appendChild(idxSpan);

                const whiteSpan = document.createElement('span');
                whiteSpan.className = `move-ply ${this.viewingPly === i ? 'active' : ''}`;
                whiteSpan.textContent = whiteMove.san;
                whiteSpan.addEventListener('click', () => this.seekHistory(i + 1));
                row.appendChild(whiteSpan);

                if (blackMove) {
                    const blackSpan = document.createElement('span');
                    blackSpan.className = `move-ply ${this.viewingPly === i + 1 ? 'active' : ''}`;
                    blackSpan.textContent = blackMove.san;
                    blackSpan.addEventListener('click', () => this.seekHistory(i + 2));
                    row.appendChild(blackSpan);
                }

                this.moveHistoryList.appendChild(row);
            }

            this.moveHistoryList.scrollTop = this.moveHistoryList.scrollHeight;
            this.updateNavButtons();
        }

        seekHistory(ply) {
            const maxPly = this.historyStack.length - 1;
            if (ply < 0 || ply > maxPly) ply = -1;

            this.viewingPly = (ply === maxPly || ply === -1) ? -1 : ply;

            const snapshot = (this.viewingPly === -1) ? this.historyStack[maxPly] : this.historyStack[this.viewingPly];
            if (snapshot) {
                this.game.load(snapshot.fen);
                this.renderBoard();
                this.updateCapturedTrays();
                this.updateStatus();
                this.renderMoveList();
                this.engine.startEvaluation(snapshot.fen);
            }
        }

        updateNavButtons() {
            const maxPly = this.historyStack.length - 1;
            const cur = (this.viewingPly === -1) ? maxPly : this.viewingPly;

            document.getElementById('stepFirstBtn').disabled = (cur <= 0);
            document.getElementById('stepPrevBtn').disabled = (cur <= 0);
            document.getElementById('stepNextBtn').disabled = (cur >= maxPly);
            document.getElementById('stepLastBtn').disabled = (cur >= maxPly);
        }

        handleUndo() {
            if (this.game.game_over()) return;
            const undoCount = (this.mode.startsWith('vs-ai') && this.game.history().length >= 2) ? 2 : 1;
            for (let i = 0; i < undoCount; i++) {
                this.game.undo();
                if (this.historyStack.length > 1) this.historyStack.pop();
            }

            this.viewingPly = -1;
            this.clearSelection();
            this.clearHintArrow();
            this.renderBoard();
            this.renderMoveList();
            this.updateCapturedTrays();
            this.updateStatus();
            this.engine.startEvaluation(this.game.fen());
            this.showToast('Move undone');
        }

        handleResign() {
            if (this.game.game_over()) return;
            const loser = this.game.turn() === 'w' ? 'White' : 'Black';
            const winner = loser === 'White' ? 'Black' : 'White';
            this.showGameOverModal(`${winner} won by resignation.`);
        }

        // Captured Pieces
        updateCapturedTrays() {
            const start = { p: 8, r: 2, n: 2, b: 2, q: 1 };
            const current = { w: { p:0,r:0,n:0,b:0,q:0 }, b: { p:0,r:0,n:0,b:0,q:0 } };

            const board = this.game.board();
            board.forEach(row => row.forEach(sq => {
                if (sq && sq.type !== 'k') current[sq.color][sq.type]++;
            }));

            const capturedByWhite = [];
            const capturedByBlack = [];
            let whitePoints = 0;
            let blackPoints = 0;
            const pieceVals = { p: 1, n: 3, b: 3, r: 5, q: 9 };

            ['p', 'n', 'b', 'r', 'q'].forEach(t => {
                const missingB = start[t] - current.b[t];
                for (let i = 0; i < missingB; i++) {
                    capturedByWhite.push('b' + t.toUpperCase());
                    whitePoints += pieceVals[t];
                }
                const missingW = start[t] - current.w[t];
                for (let i = 0; i < missingW; i++) {
                    capturedByBlack.push('w' + t.toUpperCase());
                    blackPoints += pieceVals[t];
                }
            });

            const isTopWhite = this.isFlipped;
            const topTray = document.getElementById('topCapturedTray');
            const bottomTray = document.getElementById('bottomCapturedTray');

            const renderTray = (trayEl, piecesList, scoreDiff) => {
                trayEl.innerHTML = '';
                piecesList.forEach(k => {
                    const icon = document.createElement('div');
                    icon.className = 'cap-piece';
                    icon.innerHTML = PIECE_SVGS[k] || '';
                    trayEl.appendChild(icon);
                });
                if (scoreDiff > 0) {
                    const diffBadge = document.createElement('span');
                    diffBadge.className = 'material-diff-tag';
                    diffBadge.textContent = `+${scoreDiff}`;
                    trayEl.appendChild(diffBadge);
                }
            };

            const diff = whitePoints - blackPoints;
            renderTray(topTray, isTopWhite ? capturedByBlack : capturedByWhite, isTopWhite ? (diff < 0 ? -diff : 0) : (diff > 0 ? diff : 0));
            renderTray(bottomTray, isTopWhite ? capturedByWhite : capturedByBlack, isTopWhite ? (diff > 0 ? diff : 0) : (diff < 0 ? -diff : 0));
        }

        // Mathematically Accurate Evaluation & Win Probability Updates
        updateEvaluationUI(whiteScore, whiteMateIn, depth, bestMove, pv) {
            const analysisScoreEl = document.getElementById('analysisScore');
            const analysisBestMoveEl = document.getElementById('analysisBestMove');
            const analysisDepthEl = document.getElementById('analysisDepth');
            const analysisPvEl = document.getElementById('analysisPv');
            const probFillWhite = document.getElementById('probFillWhite');
            const probTextWhite = document.getElementById('probTextWhite');
            const probTextBlack = document.getElementById('probTextBlack');

            if (depth) analysisDepthEl.textContent = `Depth ${depth}`;
            if (bestMove) analysisBestMoveEl.textContent = bestMove.length >= 4 ? `${bestMove.substring(0,2)} → ${bestMove.substring(2,4)}` : bestMove;
            if (pv) analysisPvEl.textContent = pv;

            // Handle Checkmate In X (whiteMateIn > 0 means White mates; < 0 means Black mates)
            if (whiteMateIn !== undefined && whiteMateIn !== null) {
                const isWhiteMate = whiteMateIn > 0;
                const mateMoves = Math.abs(whiteMateIn);
                const tagText = isWhiteMate ? `+M${mateMoves}` : `-M${mateMoves}`;

                this.evalFill.style.height = isWhiteMate ? '100%' : '0%';
                this.evalTag.textContent = tagText;
                this.evalTag.className = `eval-tag ${isWhiteMate ? '' : 'black-favored'}`;

                analysisScoreEl.textContent = `Mate in ${mateMoves} (${isWhiteMate ? 'White' : 'Black'})`;
                probFillWhite.style.width = isWhiteMate ? '100%' : '0%';
                probTextWhite.textContent = `White ${isWhiteMate ? 100 : 0}%`;
                probTextBlack.textContent = `Black ${isWhiteMate ? 0 : 100}%`;
                return;
            }

            // Handle Centipawn Evaluation
            if (whiteScore !== null && whiteScore !== undefined) {
                // Sigmoid winning probability: P = 1 / (1 + 10^(-score / 4))
                const winProb = 1.0 / (1.0 + Math.pow(10, -whiteScore / 4.0));
                const barPct = Math.max(5.0, Math.min(95.0, winProb * 100.0));

                this.evalFill.style.height = `${barPct.toFixed(1)}%`;

                const formattedScore = (whiteScore > 0 ? `+${whiteScore.toFixed(2)}` : (whiteScore === 0 ? '0.00' : whiteScore.toFixed(2)));
                this.evalTag.textContent = (whiteScore > 0 ? `+${whiteScore.toFixed(1)}` : (whiteScore === 0 ? '0.0' : whiteScore.toFixed(1)));
                this.evalTag.className = `eval-tag ${whiteScore < 0 ? 'black-favored' : ''}`;
                analysisScoreEl.textContent = formattedScore;

                const pctWhite = Math.round(winProb * 100);
                const pctBlack = 100 - pctWhite;
                probFillWhite.style.width = `${pctWhite}%`;
                probTextWhite.textContent = `White ${pctWhite}%`;
                probTextBlack.textContent = `Black ${pctBlack}%`;
            }
        }

        // Status Updates
        updateStatus() {
            if (this.isPaused) {
                this.statusMsgEl.textContent = 'Game paused';
                return;
            }

            const turn = this.game.turn();
            if (this.game.in_checkmate()) {
                const winner = turn === 'w' ? 'Black' : 'White';
                this.statusMsgEl.textContent = `Checkmate! ${winner} wins`;
            } else if (this.game.in_draw() || this.game.in_stalemate()) {
                this.statusMsgEl.textContent = 'Draw';
            } else if (this.game.in_check()) {
                this.statusMsgEl.textContent = `${turn === 'w' ? 'White' : 'Black'} in check!`;
            } else {
                if (this.mode === 'analysis') {
                    this.statusMsgEl.textContent = `${turn === 'w' ? 'White' : 'Black'} to move (Analysis)`;
                } else {
                    this.statusMsgEl.textContent = `${turn === 'w' ? 'White' : 'Black'} to move`;
                }
            }
        }

        handleGameOver() {
            if (this.clockTimer) clearInterval(this.clockTimer);
            clearTimeout(this.aiVsAiTimer);

            if (this.game.in_checkmate()) {
                const winner = this.game.turn() === 'w' ? 'Black' : 'White';
                const userWon = (this.mode === 'vs-ai-w' && winner === 'White') || (this.mode === 'vs-ai-b' && winner === 'Black');
                this.sounds.playGameOver(userWon);
                this.showGameOverModal(`Checkmate! ${winner} is victorious.`);
            } else if (this.game.in_stalemate()) {
                this.sounds.playGameOver(false);
                this.showGameOverModal('Stalemate! Match ended in a draw.');
            } else if (this.game.in_threefold_repetition()) {
                this.sounds.playGameOver(false);
                this.showGameOverModal('Draw by threefold repetition.');
            } else if (this.game.in_draw()) {
                this.sounds.playGameOver(false);
                this.showGameOverModal('Match ended in a draw.');
            }
        }

        showGameOverModal(desc) {
            document.getElementById('modalTitle').textContent = 'Match Finished';
            document.getElementById('modalDesc').textContent = desc;
            document.getElementById('gameOverModal').classList.add('open');
        }

        showToast(msg) {
            this.toastEl.textContent = msg;
            this.toastEl.classList.add('show');
            clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2000);
        }

        getLastMove() {
            const history = this.game.history({ verbose: true });
            return history.length > 0 ? history[history.length - 1] : null;
        }

        getKingSquare(color) {
            const board = this.game.board();
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = board[r][c];
                    if (p && p.type === 'k' && p.color === color) {
                        const file = String.fromCharCode('a'.charCodeAt(0) + c);
                        const rank = 8 - r;
                        return file + rank;
                    }
                }
            }
            return null;
        }
    }

    // Expose globally & bootstrap on DOMContentLoaded
    if (typeof window !== 'undefined') {
        window.ChessApp = ChessApp;
        document.addEventListener('DOMContentLoaded', () => {
            window.chessApp = new ChessApp();
        });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ChessApp };
    }
})();
