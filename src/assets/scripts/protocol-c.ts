(() => {
    const HIGH_KEY = 'protocol-chuck.high';

    /* ── Palette ──────────────────────────────────── */
    const C = {
        bg:         '#0F0816',
        wall:       '#3C1D42',
        wallGlow:   '#6B3875',
        floor:      '#0F0816',
        exit:       '#6B8E4E',
        exitGlow:   'rgba(107,142,78,0.5)',
        player:     '#C1436D',
        playerGlow: 'rgba(193,67,109,0.45)',
        enemy:      '#E8B04B',
        enemyGlow:  'rgba(232,176,75,0.4)',
        coin:       '#F4E3D7',
        coinGlow:   'rgba(244,227,215,0.25)',
    } as const;

    /* ── Level-dependent state (updated per init) ─── */
    let ROOMS    = 9;   // grows 9, 11, 13 … capped at 19
    let N        = 2 * ROOMS + 1;
    let ENEMY_N  = 5;
    let ENEMY_MS = 260;
    let COIN_N   = 28;
    let level    = 1;

    /* ── Canvas ───────────────────────────────────── */
    const canvas  = document.getElementById('canvas')  as HTMLCanvasElement;
    const ctx     = canvas.getContext('2d')!;
    const sceneEl = document.getElementById('scene')   as HTMLElement;

    let CELL = 40, OX = 0, OY = 0;

    function sizeCanvas() {
        const W = sceneEl.clientWidth;
        const H = sceneEl.clientHeight;
        canvas.width  = W;
        canvas.height = H;
        CELL = Math.floor(Math.min(W, H) / N);
        OX   = Math.floor((W - N * CELL) / 2);
        OY   = Math.floor((H - N * CELL) / 2);
    }

    /* ── Maze generation (iterative DFS) ─────────── */
    let grid: boolean[][];

    function buildMaze(): boolean[][] {
        const g: boolean[][] = Array.from({length: N}, (_, r) =>
            Array.from({length: N}, (_, c) => r % 2 === 0 || c % 2 === 0)
        );
        const vis = Array.from({length: ROOMS}, () => new Array<boolean>(ROOMS).fill(false));
        const stack: [number, number][] = [[0, 0]];
        vis[0][0] = true;

        while (stack.length) {
            const [rc, rr] = stack[stack.length - 1];
            const dirs = rng4();
            let pushed = false;
            for (const [dc, dr] of dirs) {
                const nc = rc + dc, nr = rr + dr;
                if (nc < 0 || nc >= ROOMS || nr < 0 || nr >= ROOMS || vis[nr][nc]) continue;
                g[rr * 2 + 1 + dr][rc * 2 + 1 + dc] = false;
                vis[nr][nc] = true;
                stack.push([nc, nr]);
                pushed = true;
                break;
            }
            if (!pushed) stack.pop();
        }

        eliminateDeadEnds(g);
        return g;
    }

    /*
     * Post-process: for every room with only one open passage (dead end),
     * knock down one of its remaining walls. Repeat until none remain.
     * Typically converges in 2–4 passes; turns the spanning-tree maze into
     * a braid maze with plenty of loops.
     */
    function eliminateDeadEnds(g: boolean[][]): void {
        const dirs: [number, number][] = [[0,-1],[1,0],[0,1],[-1,0]];
        let changed = true;
        while (changed) {
            changed = false;
            for (let rr = 0; rr < ROOMS; rr++) {
                for (let rc = 0; rc < ROOMS; rc++) {
                    const wr = rr * 2 + 1, wc = rc * 2 + 1;
                    let openCount = 0;
                    const closed: [number, number][] = [];
                    for (const [dc, dr] of dirs) {
                        const nc = rc + dc, nr = rr + dr;
                        if (nc < 0 || nc >= ROOMS || nr < 0 || nr >= ROOMS) continue;
                        if (!g[wr + dr][wc + dc]) openCount++;
                        else closed.push([dc, dr]);
                    }
                    if (openCount === 1 && closed.length > 0) {
                        const [dc, dr] = closed[(Math.random() * closed.length) | 0];
                        g[wr + dr][wc + dc] = false;
                        changed = true;
                    }
                }
            }
        }
    }

    function rng4(): [number, number][] {
        return rnd<[number,number]>([[0,-1],[1,0],[0,1],[-1,0]]);
    }
    function rnd<T>(a: T[]): T[] {
        const r = [...a];
        for (let i = r.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [r[i], r[j]] = [r[j], r[i]];
        }
        return r;
    }

    function floorCells(): [number, number][] {
        const out: [number, number][] = [];
        for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++)
                if (!grid[r][c]) out.push([c, r]);
        return out;
    }

    /* ── BFS pathfinding ─────────────────────────── */
    function bfsStep(
        startC: number, startR: number,
        goalC:  number, goalR:  number
    ): [number, number] | null {
        if (startC === goalC && startR === goalR) return null;

        const visited = new Set<string>();
        visited.add(`${startC},${startR}`);

        const q: [number, number, number, number][] = [];
        for (const [dc, dr] of [[0,-1],[1,0],[0,1],[-1,0]] as [number,number][]) {
            const nc = startC + dc, nr = startR + dr;
            if (!canStep(nc, nr)) continue;
            const k = `${nc},${nr}`;
            if (!visited.has(k)) { visited.add(k); q.push([nc, nr, dc, dr]); }
        }

        let head = 0;
        while (head < q.length) {
            const [c, r, fdc, fdr] = q[head++];
            if (c === goalC && r === goalR) return [fdc, fdr];
            for (const [dc, dr] of [[0,-1],[1,0],[0,1],[-1,0]] as [number,number][]) {
                const nc = c + dc, nr = r + dr;
                if (!canStep(nc, nr)) continue;
                const k = `${nc},${nr}`;
                if (!visited.has(k)) { visited.add(k); q.push([nc, nr, fdc, fdr]); }
            }
        }
        return null;
    }

    /* ── Audio ────────────────────────────────────── */
    let audioCtx: AudioContext | null = null;

    function audio(): AudioContext | null {
        try {
            if (!audioCtx) audioCtx = new AudioContext();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            return audioCtx;
        } catch { return null; }
    }

    function playCoin() {
        const ac = audio(); if (!ac) return;
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.connect(g); g.connect(ac.destination);
        osc.type = 'square';
        const t = ac.currentTime;
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.setValueAtTime(990, t + 0.04);
        g.gain.setValueAtTime(0.025, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        osc.start(t); osc.stop(t + 0.13);
    }

    function playWin() {
        const ac = audio(); if (!ac) return;
        const notes: [number, number][] = [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.33]];
        for (const [freq, delay] of notes) {
            const osc = ac.createOscillator(), g = ac.createGain();
            osc.connect(g); g.connect(ac.destination);
            osc.type = 'triangle';
            const t = ac.currentTime + delay;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.0, t);
            g.gain.linearRampToValueAtTime(0.05, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
            osc.start(t); osc.stop(t + 0.4);
        }
    }

    function playLose() {
        const ac = audio(); if (!ac) return;
        const notes: [number, number, number][] = [[380, 180, 0], [260, 100, 0.22]];
        for (const [startF, endF, delay] of notes) {
            const osc = ac.createOscillator(), g = ac.createGain();
            osc.connect(g); g.connect(ac.destination);
            osc.type = 'sawtooth';
            const t = ac.currentTime + delay;
            osc.frequency.setValueAtTime(startF, t);
            osc.frequency.exponentialRampToValueAtTime(endF, t + 0.18);
            g.gain.setValueAtTime(0.045, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.start(t); osc.stop(t + 0.22);
        }
    }

    /* ── Background music ────────────────────────────
       Procedural ambient loop — A natural-minor pentatonic,
       triangle waves through a low-pass filter, master gain ≈ 0.035.
       Scheduled via setTimeout + AudioContext.currentTime so note
       timing stays accurate even if frames drop.
    ─────────────────────────────────────────────────── */
    let musicTimer:  ReturnType<typeof setTimeout> | null = null;
    let musicMaster: GainNode | null = null;
    let musicStep  = 0;

    type MusicNote = { freq: number; vol: number } | null;

    /* 24-step sequence (~9 s loop at 400 ms/step).
       Wanders through A2–A3 range: questioning rise, dark fall, low anchor. */
    const MUSIC_SEQ: MusicNote[] = [
        { freq: 220, vol: 0.85 }, null,
        { freq: 261, vol: 0.60 }, { freq: 293, vol: 0.55 },
        null,                      { freq: 261, vol: 0.50 },
        null,                      null,
        { freq: 220, vol: 0.80 }, { freq: 196, vol: 0.55 },
        null,                      { freq: 174, vol: 0.60 },
        { freq: 165, vol: 0.65 }, null,
        { freq: 147, vol: 0.55 }, null,
        { freq: 110, vol: 0.70 }, null,
        null,                      { freq: 165, vol: 0.45 },
        null,                      { freq: 220, vol: 0.60 },
        null,                      null,
    ];
    const MUSIC_STEP_MS = 400;  // ≈ 75 BPM eighth-notes
    const MUSIC_VOL     = 0.14;

    function startMusic() {
        const ac = audio(); if (!ac) return;
        stopMusic(false);

        musicMaster = ac.createGain();
        musicMaster.gain.setValueAtTime(0, ac.currentTime);
        musicMaster.gain.linearRampToValueAtTime(MUSIC_VOL, ac.currentTime + 1.5);
        musicMaster.connect(ac.destination);

        musicStep = 0;
        tickMusic();
    }

    function tickMusic() {
        const ac     = audio();
        const master = musicMaster;
        if (!ac || !master) return;

        const note = MUSIC_SEQ[musicStep % MUSIC_SEQ.length];
        musicStep++;

        if (note) {
            const osc = ac.createOscillator();
            const env = ac.createGain();
            const flt = ac.createBiquadFilter();

            osc.connect(flt); flt.connect(env); env.connect(master);

            osc.type            = 'triangle';
            flt.type            = 'lowpass';
            flt.frequency.value = 550;
            flt.Q.value         = 0.4;

            const t   = ac.currentTime;
            const dur = (MUSIC_STEP_MS / 1000) * 0.62;

            osc.frequency.setValueAtTime(note.freq, t);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(note.vol, t + 0.018);
            env.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.start(t); osc.stop(t + dur + 0.02);
        }

        musicTimer = setTimeout(tickMusic, MUSIC_STEP_MS);
    }

    function stopMusic(fade = true) {
        if (musicTimer !== null) { clearTimeout(musicTimer); musicTimer = null; }
        if (!musicMaster) return;

        const g  = musicMaster;
        musicMaster = null;

        const ac = audio();
        if (fade && ac) {
            g.gain.cancelScheduledValues(ac.currentTime);
            g.gain.setValueAtTime(g.gain.value, ac.currentTime);
            g.gain.linearRampToValueAtTime(0, ac.currentTime + 1.2);
            setTimeout(() => { try { g.disconnect(); } catch {} }, 1400);
        } else {
            try { g.disconnect(); } catch {}
        }
    }

    /* ── Coordinate helpers ───────────────────────── */
    const tileX   = (c: number) => OX + c * CELL;
    const tileY   = (r: number) => OY + r * CELL;
    const centerX = (c: number) => OX + c * CELL + CELL / 2;
    const centerY = (r: number) => OY + r * CELL + CELL / 2;

    function lerpPos(srcC: number, srcR: number, dstC: number, dstR: number, t: number) {
        return {
            x: centerX(srcC) + (centerX(dstC) - centerX(srcC)) * t,
            y: centerY(srcR) + (centerY(dstR) - centerY(srcR)) * t,
        };
    }

    /* ── Input state ──────────────────────────────── */
    const held = { up: false, down: false, left: false, right: false };

    function getHeldDir(): [number, number] | null {
        if (held.up)    return [0, -1];
        if (held.right) return [1,  0];
        if (held.down)  return [0,  1];
        if (held.left)  return [-1, 0];
        return null;
    }

    /* ── Drawing ──────────────────────────────────── */
    function drawWall(col: number, row: number) {
        const x = tileX(col), y = tileY(row);
        ctx.fillStyle = C.wall;
        ctx.fillRect(x, y, CELL, CELL);
        const B = Math.max(2, CELL >> 4);
        ctx.fillStyle = C.wallGlow;
        if (row > 0     && !grid[row - 1][col]) ctx.fillRect(x,            y,            CELL, B);
        if (row < N - 1 && !grid[row + 1][col]) ctx.fillRect(x,            y + CELL - B, CELL, B);
        if (col > 0     && !grid[row][col - 1]) ctx.fillRect(x,            y,            B,    CELL);
        if (col < N - 1 && !grid[row][col + 1]) ctx.fillRect(x + CELL - B, y,            B,    CELL);
    }

    function drawExit(col: number, row: number, tick: number) {
        const x = tileX(col), y = tileY(row);
        const pulse = 0.5 + 0.5 * Math.sin(tick / 420);
        ctx.fillStyle = C.exit;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.save();
        ctx.shadowColor = C.exitGlow;
        ctx.shadowBlur  = 8 + pulse * 14;
        ctx.fillStyle   = C.exitGlow;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.restore();
    }

    function drawCoin(col: number, row: number, tick: number) {
        const base  = Math.max(2, CELL * 0.1);
        const pulse = 0.85 + 0.15 * Math.sin(tick / 280 + col * 0.9 + row * 1.5);
        ctx.save();
        ctx.shadowColor = C.coinGlow;
        ctx.shadowBlur  = 5;
        ctx.beginPath();
        ctx.arc(centerX(col), centerY(row), base * pulse, 0, Math.PI * 2);
        ctx.fillStyle = C.coin;
        ctx.fill();
        ctx.restore();
    }

    function drawPlayer(px: number, py: number, dirC: number, dirR: number, moveT: number) {
        const r     = CELL * 0.34;
        const angle = (dirC !== 0 || dirR !== 0) ? Math.atan2(dirR, dirC) : 0;
        const chomp = Math.abs(Math.sin(moveT * Math.PI)) * 0.30 + 0.05;
        ctx.save();
        ctx.shadowColor = C.playerGlow;
        ctx.shadowBlur  = 18;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, r, angle + chomp, angle - chomp + Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = C.player;
        ctx.fill();
        ctx.restore();
    }

    function drawEnemy(px: number, py: number, playerX: number, playerY: number) {
        const r = CELL * 0.29;
        ctx.save();
        ctx.shadowColor = C.enemyGlow;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = C.enemy;
        ctx.fill();
        ctx.restore();
        const dx = playerX - px, dy = playerY - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ex = px + (dx / dist) * r * 0.38;
        const ey = py + (dy / dist) * r * 0.38;
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = C.bg;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
            ex + (dx / dist) * r * 0.06,
            ey + (dy / dist) * r * 0.06,
            r * 0.1, 0, Math.PI * 2
        );
        ctx.fillStyle = C.player;
        ctx.fill();
    }

    /* ── Game state ───────────────────────────────── */
    type GState = 'idle' | 'running' | 'won' | 'over' | 'finished';
    let state: GState = 'idle';

    let EXIT_C = N - 2, EXIT_R = N - 2;

    let pCol = ROOMS, pRow = ROOMS;
    let pSrcC = ROOMS, pSrcR = ROOMS;
    let pMoveT = 1.0, pDirC = 1, pDirR = 0;

    interface Enemy {
        col: number; row: number;
        srcC: number; srcR: number;
        moveT: number;
        aggro: number;
    }
    let enemies: Enemy[] = [];
    let coins    = new Set<string>();
    let score    = 0;
    let high     = +(localStorage.getItem(HIGH_KEY) ?? 0);
    let enemyAccum = 0, lastTs = 0;

    const key = (c: number, r: number) => `${c},${r}`;

    /* ── Init ─────────────────────────────────────── */
    function init(resetScore: boolean) {
        /* level-dependent parameters */
        ROOMS    = Math.min(9 + (level - 1) * 2, 19);  // 9, 11 … 19, then stays
        N        = 2 * ROOMS + 1;
        ENEMY_N  = Math.min(4 + level, 12);
        ENEMY_MS = Math.max(160, 260 - (level - 1) * 15);
        COIN_N   = Math.floor(ROOMS * ROOMS * 0.35);

        grid = buildMaze();
        const floors = rnd(floorCells());

        const startC = ROOMS, startR = ROOMS;   // centre is always at (ROOMS, ROOMS)

        /* random corner for exit (corners scale with current N) */
        const corners: [number, number][] = [[1,1],[N-2,1],[1,N-2],[N-2,N-2]];
        const corner = corners[(Math.random() * corners.length) | 0];
        EXIT_C = corner[0]; EXIT_R = corner[1];

        pCol = startC; pRow = startR;
        pSrcC = startC; pSrcR = startR;
        pMoveT = 1.0; pDirC = 1; pDirR = 0;

        const taken = new Set([key(startC, startR), key(EXIT_C, EXIT_R)]);

        enemies = [];
        const far  = floors.filter(([c, r]) =>
            Math.abs(c - startC) + Math.abs(r - startR) >= 8
        );
        const pool = far.length >= ENEMY_N ? far : floors;
        for (const [c, r] of pool) {
            if (enemies.length >= ENEMY_N) break;
            if (taken.has(key(c, r))) continue;
            taken.add(key(c, r));
            enemies.push({
                col: c, row: r, srcC: c, srcR: r, moveT: 1.0,
                aggro: Math.max(0.92 - enemies.length * 0.09, 0.25),
            });
        }

        coins = new Set();
        for (const [c, r] of floors) {
            if (coins.size >= COIN_N) break;
            if (taken.has(key(c, r))) continue;
            taken.add(key(c, r));
            coins.add(key(c, r));
        }

        if (resetScore) score = 0;
        enemyAccum = 0;
        syncHUD();
    }

    /* ── HUD ──────────────────────────────────────── */
    const scoreEl = document.getElementById('score')!;
    const highEl  = document.getElementById('high-score')!;
    const levelEl = document.getElementById('level-display')!;
    highEl.textContent = String(high);

    function syncHUD() {
        scoreEl.textContent = String(score);
        levelEl.textContent = String(level);
        if (score > high) {
            high = score;
            localStorage.setItem(HIGH_KEY, String(high));
            highEl.textContent = String(high);
        }
    }

    /* ── DOM helpers ──────────────────────────────── */
    function mkEl(tag: string, cls?: string, text?: string): HTMLElement {
        const e = document.createElement(tag);
        if (cls)             e.className   = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }
    function mkSpan(text: string, cls?: string): HTMLSpanElement {
        return mkEl('span', cls, text) as HTMLSpanElement;
    }
    function mkKbd(key: string): HTMLElement {
        return mkEl('kbd', 'kbd', key);
    }
    function mkPara(cls: string, text: string): HTMLParagraphElement {
        return mkEl('p', 'card__para ' + cls, text) as HTMLParagraphElement;
    }

    /* ── Overlay ──────────────────────────────────── */
    const overlayEl = document.getElementById('overlay')!;
    const titleEl   = document.getElementById('overlayTitle')!;
    const bodyEl    = document.getElementById('overlayBody')!;
    const startBtn  = document.getElementById('startBtn')!;
    const finishBtn = document.getElementById('finishBtn') as HTMLButtonElement;

    /* The primary button's action changes depending on game state */
    let primaryAction: () => void = freshStart;

    function showCard(opts: {
        title:        string;
        nodes:        Node[];
        startLabel:   string;
        finishLabel?: string;
    }) {
        titleEl.textContent = opts.title;

        /* replace body content */
        bodyEl.textContent = '';
        for (const n of opts.nodes) bodyEl.appendChild(n);

        startBtn.textContent  = opts.startLabel;

        if (opts.finishLabel) {
            finishBtn.textContent = opts.finishLabel;
            finishBtn.hidden      = false;
        } else {
            finishBtn.hidden = true;
        }

        overlayEl.hidden = false;
    }

    /* ── Card body builders ────────────────────────── */

    function startNodes(): Node[] {
        /* Para 1 — controls */
        const p1 = mkEl('p', 'card__para');
        const keys = mkEl('span', 'card__keys');
        keys.append(
            mkSpan('move', 'card__keys-label'),
            mkKbd('W'), mkKbd('A'), mkKbd('S'), mkKbd('D'),
            mkSpan('or', 'card__keys-sep'),
            mkKbd('↑'), mkKbd('←'), mkKbd('↓'), mkKbd('→')
        );
        p1.appendChild(keys);

        /* Para 2 — objective */
        const p2 = mkPara('', 'collect coins as you explore · reach the glowing exit to clear the level.');

        /* Para 3 — risk / meta */
        const p3 = mkPara('card__para--dim',
            'clearing a level unlocks the next — bigger maze, more enemies, faster pace. ' +
            'keep going to grow your score, but if you\'re caught while risking, all points are lost.');

        return [p1, p2, p3];
    }

    function winNodes(sc: number, coinsLeft: number, nextLv: number,
                      nextN: number, nextEnemies: number, nextMs: number): Node[] {
        const p1 = mkPara('card__para--hi',
            `score: ${sc}  ·  ${coinsLeft === 0 ? 'full clear!' : `${coinsLeft} coins left.`}`
        );
        const p2 = mkPara('card__para--warn',
            `level ${nextLv}: ${nextN}×${nextN} maze · ${nextEnemies} enemies · ${nextMs} ms speed` +
            `\nif caught, you lose all ${sc} points.`
        );
        return [p1, p2];
    }

    function overNodes(sc: number, hi: number, lv: number): Node[] {
        if (lv > 1) {
            return [
                mkPara('card__para--hi', `lost all ${sc} points on level ${lv}.`),
                mkPara('card__para--dim', 'all accumulated points are gone. back to level 1.'),
            ];
        }
        return [mkPara('card__para--hi', `score: ${sc}  ·  best: ${hi}.`)];
    }

    function cashedNodes(sc: number, hi: number): Node[] {
        const isNewBest = sc >= hi;
        return [mkPara('card__para--hi',
            `you secured ${sc} pts.  ${isNewBest ? 'new best!' : `best: ${hi}.`}`
        )];
    }

    /* ── Level / session control ──────────────────── */

    /* Show the initial start screen explicitly so finishBtn is always hidden */
    function showInitialCard() {
        primaryAction = freshStart;
        showCard({
            title:      'protocol-chuck',
            nodes:      startNodes(),
            startLabel: 'start',
        });
    }

    /* Start or restart from level 1 */
    function freshStart() {
        level = 1;
        startLevel(true);
    }

    /* Advance to the next level, keeping the accumulated score */
    function continueToNext() {
        level++;
        startLevel(false);
    }

    /* Player chose to lock in current score and stop */
    function cashOut() {
        state = 'finished';
        primaryAction = showInitialCard;
        showCard({
            title:      'cashed out.',
            nodes:      cashedNodes(score, high),
            startLabel: 'play again',
        });
    }

    /* Core: build the maze for the current level and begin */
    function startLevel(resetScore: boolean) {
        init(resetScore);   // sets ROOMS/N before sizeCanvas
        sizeCanvas();
        state      = 'running';
        overlayEl.hidden = true;
        lastTs     = performance.now();
        enemyAccum = 0;
        startMusic();
        requestAnimationFrame(loop);
    }

    /* ── Render ───────────────────────────────────── */
    function render(tick = 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!grid) return;

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (grid[r][c]) {
                    drawWall(c, r);
                } else {
                    if (c === EXIT_C && r === EXIT_R) drawExit(c, r, tick);
                    if (coins.has(key(c, r))) drawCoin(c, r, tick);
                }
            }
        }

        const pPos = pMoveT >= 1.0
            ? { x: centerX(pCol), y: centerY(pRow) }
            : lerpPos(pSrcC, pSrcR, pCol, pRow, pMoveT);

        for (const e of enemies) {
            const ePos = e.moveT >= 1.0
                ? { x: centerX(e.col), y: centerY(e.row) }
                : lerpPos(e.srcC, e.srcR, e.col, e.row, e.moveT);
            drawEnemy(ePos.x, ePos.y, pPos.x, pPos.y);
        }

        drawPlayer(pPos.x, pPos.y, pDirC, pDirR, pMoveT);
    }

    /* ── Movement ─────────────────────────────────── */
    function canStep(c: number, r: number): boolean {
        return c >= 0 && c < N && r >= 0 && r < N && !grid[r][c];
    }

    function startMove(dc: number, dr: number): boolean {
        const nc = pCol + dc, nr = pRow + dr;
        if (!canStep(nc, nr)) return false;
        pSrcC = pCol; pSrcR = pRow;
        pCol = nc; pRow = nr;
        pMoveT = 0.0;
        pDirC = dc; pDirR = dr;
        return true;
    }

    function resolvePlayer(dt: number) {
        if (pMoveT >= 1.0) {
            const dir = getHeldDir();
            if (dir) startMove(dir[0], dir[1]);
            return;
        }

        pMoveT = Math.min(1.0, pMoveT + dt / 90);

        if (pMoveT >= 1.0) {
            const k = key(pCol, pRow);
            if (coins.has(k)) { coins.delete(k); score += 10; syncHUD(); playCoin(); }
            if (pCol === EXIT_C && pRow === EXIT_R) { doWin(); return; }
            hitCheck();
            if (state !== 'running') return;
            const dir = getHeldDir();
            if (dir) startMove(dir[0], dir[1]);
        }
    }

    function resolveEnemies(dt: number) {
        if (state !== 'running') return;
        for (const e of enemies) {
            if (e.moveT < 1.0) e.moveT = Math.min(1.0, e.moveT + dt / ENEMY_MS);
        }
        enemyAccum += dt;
        if (enemyAccum >= ENEMY_MS) {
            enemyAccum -= ENEMY_MS;
            for (const e of enemies) e.moveT = 1.0;
            stepEnemies();
        }
    }

    function stepEnemies() {
        for (const e of enemies) {
            let dir: [number, number] | null = null;
            if (Math.random() < e.aggro) dir = bfsStep(e.col, e.row, pCol, pRow);
            if (!dir) {
                const opts = rng4().filter(([dc, dr]) => canStep(e.col + dc, e.row + dr));
                if (opts.length) dir = opts[0];
            }
            if (dir) {
                e.srcC = e.col; e.srcR = e.row;
                e.col += dir[0]; e.row += dir[1];
                e.moveT = 0.0;
            }
        }
        hitCheck();
    }

    function hitCheck() {
        for (const e of enemies) {
            if (e.col === pCol && e.row === pRow) { doOver(); return; }
        }
    }

    /* ── End states ───────────────────────────────── */
    function doWin() {
        state = 'won';
        stopMusic();
        score += 50;
        syncHUD();
        playWin();
        primaryAction = continueToNext;

        /* describe what the next level brings */
        const nextLv      = level + 1;
        const nextRooms   = Math.min(9 + (nextLv - 1) * 2, 19);
        const nextN       = 2 * nextRooms + 1;
        const nextEnemies = Math.min(4 + nextLv, 12);
        const nextMs      = Math.max(160, 260 - (nextLv - 1) * 15);

        showCard({
            title:       `level ${level} cleared!`,
            nodes:       winNodes(score, coins.size, nextLv, nextN, nextEnemies, nextMs),
            startLabel:  'next level →',
            finishLabel: `cash out  ·  save ${score} pts`,
        });
    }

    function doOver() {
        state = 'over';
        stopMusic();
        playLose();
        primaryAction = showInitialCard;
        showCard({
            title:      'caught.',
            nodes:      overNodes(score, high, level),
            startLabel: 'try again',
        });
    }

    /* ── Loop ─────────────────────────────────────── */
    function loop(ts: number) {
        if (state !== 'running') return;
        const dt = Math.min(ts - lastTs, 50);
        lastTs = ts;
        resolvePlayer(dt);
        resolveEnemies(dt);
        render(ts);
        if (state === 'running') requestAnimationFrame(loop);
    }

    /* ── Input ────────────────────────────────────── */
    function keyToDir(k: string): keyof typeof held | null {
        if (k === 'ArrowUp'    || k === 'w' || k === 'W') return 'up';
        if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
        if (k === 'ArrowDown'  || k === 's' || k === 'S') return 'down';
        if (k === 'ArrowLeft'  || k === 'a' || k === 'A') return 'left';
        return null;
    }

    document.addEventListener('keydown', e => {
        const dir = keyToDir(e.key);
        if (dir) { e.preventDefault(); held[dir] = true; }
        if (state !== 'running' && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault(); primaryAction();
        }
    });
    document.addEventListener('keyup', e => {
        const dir = keyToDir(e.key);
        if (dir) held[dir] = false;
    });

    startBtn.addEventListener('click',  () => primaryAction());
    finishBtn.addEventListener('click', () => cashOut());

    let tx = 0, ty = 0;
    canvas.addEventListener('touchstart', e => {
        tx = e.touches[0].clientX; ty = e.touches[0].clientY;
        e.preventDefault();
    }, {passive: false});
    canvas.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tx;
        const dy = e.changedTouches[0].clientY - ty;
        if (state !== 'running') { primaryAction(); return; }
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            held.left = dx < 0; held.right = dx > 0; held.up = false; held.down = false;
        } else {
            held.up = dy < 0; held.down = dy > 0; held.left = false; held.right = false;
        }
        e.preventDefault();
    }, {passive: false});

    window.addEventListener('resize', () => { sizeCanvas(); render(); });

    /* ── Boot ─────────────────────────────────────── */
    // Build a preview maze behind the start card; showInitialCard guarantees
    // finishBtn is hidden and all text is set correctly from the start.
    ROOMS = 9; N = 2 * ROOMS + 1;
    sizeCanvas();
    grid = buildMaze();
    render();
    showInitialCard();
})();
