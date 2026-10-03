/// <reference types="vite/client" />

declare const __BUILD_DATE__: string;
declare const __BUILD_COMMIT__: string;

function store(key: string, value?: string): string | null {
    try {
        if (value !== undefined) localStorage.setItem(key, value);
        return localStorage.getItem(key);
    } catch { return null; }
}

/* ── LED board ───────────────────────────────────────────── */

// 5×7 font, ' ' (0x20) to '_' (0x5F). 5 column bytes per glyph, bit 0 = top row.
const GLYPHS = [
    '0000000000', '00005F0000', '0007000700', '147F147F14', '242A7F2A12', '2313086462', '3649552250', '0005030000', //   ! " # $ % & '
    '001C224100', '0041221C00', '082A1C2A08', '08083E0808', '0050300000', '0808080808', '0060600000', '2010080402', // ( ) * + , - . /
    '3E5149453E', '00427F4000', '4261514946', '2141454B31', '1814127F10', '2745454539', '3C4A494930', '0171090503', // 0 - 7
    '3649494936', '064949291E', '0036360000', '0056360000', '0814224100', '1414141414', '0041221408', '0201510906', // 8 9 : ; < = > ?
    '324979413E', '7E1111117E', '7F49494936', '3E41414122', '7F4141221C', '7F49494941', '7F09090101', '3E41415132', // @ A - G
    '7F0808087F', '00417F4100', '2040413F01', '7F08142241', '7F40404040', '7F0204027F', '7F0408107F', '3E4141413E', // H - O
    '7F09090906', '3E4151215E', '7F09192946', '4649494931', '01017F0101', '3F4040403F', '1F2040201F', '7F2018207F', // P - W
    '6314081463', '0304780403', '6151494543', '00007F4141', '0204081020', '41417F0000', '0402010204', '4040404040', // X Y Z [ \ ] ^ _
];

function bitmap(text: string): number[] {
    const cols: number[] = [];
    for (const ch of text.toUpperCase()) {
        const glyph = GLYPHS[ch.charCodeAt(0) - 32] ?? GLYPHS[0];
        for (let c = 0; c < 10; c += 2) cols.push(parseInt(glyph.slice(c, c + 2), 16));
        cols.push(0);
    }
    return cols;
}

// One screen = one item. Short items enter, rest and leave with a simple effect; long ones scroll across.
const STACK = [
    'PHP', 'Laravel', 'TypeScript', 'System Design', 'MySQL', 'Redis', 'OpenSearch', 'ClickHouse',
    'Temporal', 'Linux', 'Docker', 'Amazon Web Services', 'Agentic Coding',
];

interface Screen { cols: number[]; chars: number; words: number; wordOf: number[] }
// Where a lit dot ends up: [dx, dy, brightness]. p goes 0 → 1 while entering; leaving plays it backwards.
type Effect = (p: number, s: Screen, i: number, r: number) => [number, number, number];

function screen(label: string): Screen {
    const wordOf: number[] = [];
    let w = 0;
    for (const ch of label) {
        for (let c = 0; c < 6; c++) wordOf.push(w);
        if (ch === ' ') w++;
    }
    return { cols: bitmap(label).slice(0, -1), chars: label.length, words: w + 1, wordOf };
}

const noise = (a: number, b: number) => {
    const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return n - Math.floor(n);
};
const ease = (p: number) => 1 - (1 - p) ** 3;
const away = (s: Screen) => s.cols.length + 24;

const EFFECTS: Record<string, Effect> = {
    fade:     (p) => [0, 0, ease(p)],
    left:     (p, s) => [-(1 - ease(p)) * away(s), 0, 1],
    right:    (p, s) => [(1 - ease(p)) * away(s), 0, 1],
    drop:     (p) => [0, -(1 - ease(p)) * 9, 1],
    rise:     (p) => [0, (1 - ease(p)) * 9, 1],
    type:     (p, s, i) => [0, 0, Math.floor(i / 6) < p * s.chars ? 1 : 0],
    words:    (p, s, i) => [0, 0, s.wordOf[i] < p * s.words ? 1 : 0],
    wipe:     (p, s, i) => [0, 0, i < ease(p) * s.cols.length ? 1 : 0],
    curtain:  (p, s, i) => [0, 0, Math.abs(i - s.cols.length / 2) < ease(p) * s.cols.length / 2 ? 1 : 0],
    dissolve: (p, _s, i, r) => [0, 0, noise(i, r) < p ? 1 : 0],
};
const NAMES = Object.keys(EFFECTS);

function startLed(canvas: HTMLCanvasElement, items: string[]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.setAttribute('aria-label', items.join(', '));

    const ROWS = 9, TOP = 1, LEVELS = 4, SCROLL_MS = 35;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const list = items.map(screen).sort(() => Math.random() - 0.5);

    let pitch = 6, width = 0, pad = 0;
    let index = 0, stage: 'in' | 'hold' | 'out' | 'gap' | 'scroll' = 'gap', since = 0, last = 0;
    let fxIn = 'fade', fxOut = 'fade', pulse = false;
    const buffer: number[] = [];

    const pick = (not: string) => {
        if (calm) return 'fade';
        let name = not;
        while (name === not) name = NAMES[Math.floor(Math.random() * NAMES.length)];
        return name;
    };
    const fits = (s: Screen) => s.cols.length <= width - 4;
    const duration = (s: Screen) => ({
        in: 700, hold: 2000, out: 500, gap: 350,
        scroll: (width + s.cols.length) * (calm ? SCROLL_MS * 2 : SCROLL_MS),
    })[stage];

    function resize() {
        const cssW = canvas.clientWidth, dpr = devicePixelRatio || 1;
        pitch = cssW < 480 ? 4 : 6;
        width = Math.floor(cssW / pitch);
        pad = (cssW - width * pitch) / 2;
        canvas.style.height = ROWS * pitch + 'px';
        canvas.width = cssW * dpr;
        canvas.height = ROWS * pitch * dpr;
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function advance(t: number) {
        if (t - since < duration(list[index])) return;
        since = t;
        if (stage === 'in') { stage = 'hold'; pulse = !calm && Math.random() < 0.3; }
        else if (stage === 'hold') { stage = 'out'; fxOut = pick(fxIn); }
        else if (stage === 'out' || stage === 'scroll') stage = 'gap';
        else {
            index = (index + 1) % list.length;
            stage = fits(list[index]) ? 'in' : 'scroll';
            fxIn = pick(fxOut);
        }
    }

    function render(t: number) {
        buffer.length = width * ROWS;
        buffer.fill(0);
        if (stage === 'gap') return;

        const s = list[index], ms = t - since, p = Math.min(1, ms / duration(s));
        const sx = stage === 'scroll' ? width - Math.floor(ms / (calm ? SCROLL_MS * 2 : SCROLL_MS)) : Math.floor((width - s.cols.length) / 2);
        s.cols.forEach((col, i) => {
            for (let r = 0; r < 7; r++) {
                if (!((col >> r) & 1)) continue;
                let [dx, dy, a] = [0, 0, 1];
                if (stage === 'in') [dx, dy, a] = EFFECTS[fxIn](p, s, i, r);
                if (stage === 'out') [dx, dy, a] = EFFECTS[fxOut](1 - p, s, i, r);
                if (stage === 'hold' && pulse) a = 0.75 + 0.25 * Math.cos(ms / 300);
                const x = sx + i + Math.round(dx), y = TOP + r + Math.round(dy);
                if (x >= 0 && x < width && y >= 0 && y < ROWS) buffer[y * width + x] = a;
            }
        });
    }

    function draw() {
        // Lit dots take the text colour, unlit ones the muted colour — so the board follows the theme.
        const css = getComputedStyle(document.documentElement);
        const levels = Array.from({ length: LEVELS + 1 }, () => new Path2D());
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < width; x++) {
            const b = Math.round(buffer[y * width + x] * LEVELS);
            const cx = pad + x * pitch + pitch / 2, cy = y * pitch + pitch / 2, r = pitch * (b ? 0.36 : 0.3);
            levels[b].moveTo(cx + r, cy);
            levels[b].arc(cx, cy, r, 0, Math.PI * 2);
        }

        ctx!.clearRect(0, 0, canvas.width, canvas.height);
        ctx!.globalAlpha = 0.25;
        ctx!.fillStyle = css.getPropertyValue('--muted');
        ctx!.fill(levels[0]);
        ctx!.fillStyle = css.getPropertyValue('--fg');
        for (let b = 1; b <= LEVELS; b++) {
            ctx!.globalAlpha = b / LEVELS;
            ctx!.fill(levels[b]);
        }
    }

    function tick(t: number) {
        if (width && t - last >= 33) {
            last = t;
            advance(t);
            render(t);
            draw();
        }
        requestAnimationFrame(tick);
    }

    new ResizeObserver(resize).observe(canvas);
    requestAnimationFrame(tick);
}

/* ── analytics (opt-out: loads unless rejected) ─────────── */

const GTM_ID = 'GTM-KH64L7ZR';

function loadGTM() {
    if (document.getElementById('gtm-loader')) return;
    const s = document.createElement('script');
    s.id = 'gtm-loader';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.append(s);
}

function setupConsent() {
    const bar = document.getElementById('consent');
    const status = document.getElementById('consent-status');
    if (!bar || !status) return;

    const render = () => {
        const choice = store('cookies');
        bar.hidden = choice !== null;
        const change = document.createElement('button');
        change.type = 'button';
        change.textContent = 'change';
        change.addEventListener('click', () => (bar.hidden = false));
        status.replaceChildren(`analytics: ${choice === '0' ? 'off' : 'on'} (`, change, ')');
    };

    if (store('cookies') !== '0') loadGTM();
    render();

    document.getElementById('consent-accept')?.addEventListener('click', () => {
        store('cookies', '1');
        loadGTM();
        render();
    });
    document.getElementById('consent-reject')?.addEventListener('click', () => {
        store('cookies', '0');
        // GTM can't be unloaded; a reload drops it.
        if (document.getElementById('gtm-loader')) location.reload();
        else render();
    });
}

/* ── theme: follows the system until the visitor picks one ─ */

function setupTheme() {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.theme button');
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const render = () => {
        const current = document.documentElement.dataset.theme || (dark.matches ? 'dark' : 'light');
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === current)));
    };
    buttons.forEach(b => b.addEventListener('click', () => {
        document.documentElement.dataset.theme = b.dataset.theme;
        store('theme', b.dataset.theme);
        render();
    }));
    dark.addEventListener('change', render);
    render();
}

/* ── easter egg: type "chuck" anywhere ───────────────────── */

function setupChuck() {
    let typed = '';
    addEventListener('keydown', (e) => {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        typed = (typed + e.key.toLowerCase()).slice(-5);
        if (typed === 'chuck') location.href = 'protocol-c.html';
    });
}

/* ── boot ────────────────────────────────────────────────── */

const led = document.getElementById('led');
if (led instanceof HTMLCanvasElement) startLed(led, STACK);

const built = document.getElementById('build-date');
if (built instanceof HTMLAnchorElement) {
    built.textContent = __BUILD_DATE__;
    built.title = __BUILD_COMMIT__.slice(0, 7);
    built.href = `https://github.com/plumthedev/plumthedev.cloud/commit/${__BUILD_COMMIT__}`;
}

setupTheme();
setupConsent();
setupChuck();

if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
