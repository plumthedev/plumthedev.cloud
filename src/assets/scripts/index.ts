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

// The logo: dots lit at GLOW, with random sparks flashing to full brightness.
// say() scrolls one message through it in the accent colour, then the logo comes back.
function startLed(canvas: HTMLCanvasElement, text: string): (text: string) => void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};

    const ROWS = 7, LEVELS = 20, SCROLL_MS = 35, GLOW = 0.6;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const logo = bitmap(text).slice(0, -1), width = logo.length;
    const buffer = new Array<number>(width * ROWS);
    let once: number[] | null = null, since = 0, last = 0, pitch = 2, dpr = 1;
    // lit dots of the logo (buffer indexes) and the ones twinkling right now (index → start time)
    const lit = logo.flatMap((col, x) => [...Array(ROWS).keys()].filter(r => (col >> r) & 1).map(r => r * width + x));
    const sparks = new Map<number, number>();

    // CSS sets the width; the dots stretch to fill it and the height follows.
    const resize = () => {
        dpr = devicePixelRatio || 1;
        pitch = canvas.clientWidth / width;
        canvas.style.height = ROWS * pitch + 'px';
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(ROWS * pitch * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // resizing wipes the canvas; repaint now rather than on the next tick
        render(performance.now());
        draw();
    };
    resize();
    new ResizeObserver(resize).observe(canvas);

    function render(t: number) {
        buffer.fill(0);
        const ms = t - since;
        if (once && width - ms / SCROLL_MS + once.length < 0) once = null;
        const cols = once ?? logo;
        const sx = once ? width - Math.floor(ms / SCROLL_MS) : 0;
        cols.forEach((col, i) => {
            const x = sx + i;
            if (x < 0 || x >= width) return;
            const a = once ? 1 : GLOW;
            for (let r = 0; r < ROWS; r++) if ((col >> r) & 1) buffer[r * width + x] = a;
        });
        // sparks: random dots flash to full and fade out fast
        if (!once && !calm) {
            if (Math.random() < 0.15) sparks.set(lit[Math.floor(Math.random() * lit.length)], t);
            sparks.forEach((t0, k) => {
                const age = (t - t0) / 450;
                if (age >= 1) sparks.delete(k);
                else buffer[k] = GLOW + (1 - GLOW) * (1 - age) ** 2;
            });
        }
        // the hit: the whole board lights up and fades into the message
        if (once && ms < 400) for (let k = 0; k < buffer.length; k++) buffer[k] = Math.max(buffer[k], 1 - ms / 400);
    }

    function draw() {
        // Lit dots take the text colour, unlit ones the muted colour, read live from CSS.
        const css = getComputedStyle(document.documentElement);
        const levels = Array.from({ length: LEVELS + 1 }, () => new Path2D());
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < width; x++) {
            const b = Math.round(buffer[y * width + x] * LEVELS);
            // tiny dots on a low-res screen: a sub-pixel circle blurs to half its brightness, so a crisp square stands in
            if (pitch * dpr < 4) { levels[b].rect(x * pitch, y * pitch, pitch / 2, pitch / 2); continue; }
            const cx = x * pitch + pitch / 2, cy = y * pitch + pitch / 2, r = pitch * (b ? 0.36 : 0.3);
            levels[b].moveTo(cx + r, cy);
            levels[b].arc(cx, cy, r, 0, Math.PI * 2);
        }

        ctx!.clearRect(0, 0, canvas.width, canvas.height);
        ctx!.globalAlpha = 0.12;
        ctx!.fillStyle = css.getPropertyValue('--muted');
        ctx!.fill(levels[0]);
        ctx!.fillStyle = css.getPropertyValue(once ? '--accent' : '--fg');
        for (let b = 1; b <= LEVELS; b++) {
            ctx!.globalAlpha = b / LEVELS;
            ctx!.fill(levels[b]);
        }
    }

    function tick(t: number) {
        if (t - last >= 33) {
            last = t;
            render(t);
            draw();
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    return (message) => {
        once = bitmap(message);
        since = performance.now();
    };
}

/* ── analytics (opt-out: on unless switched off) ─────────── */

const GTM_ID = 'GTM-KH64L7ZR';

function loadGTM() {
    if (document.getElementById('gtm-loader')) return;
    const s = document.createElement('script');
    s.id = 'gtm-loader';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.append(s);
}

function setupAnalytics() {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.analytics button');
    const render = () => {
        const on = store('cookies') !== '0';
        buttons.forEach(b => b.setAttribute('aria-pressed', String((b.dataset.on === '1') === on)));
    };
    buttons.forEach(b => b.addEventListener('click', () => {
        store('cookies', b.dataset.on);
        // GTM can't be unloaded; a reload drops it.
        if (b.dataset.on === '0' && document.getElementById('gtm-loader')) return location.reload();
        if (b.dataset.on === '1') loadGTM();
        render();
    }));
    if (store('cookies') !== '0') loadGTM();
    render();
}

/* ── easter egg: type "chuck" anywhere ───────────────────── */

const FACTS = [
    "Chuck Norris doesn't need a load balancer. Servers balance themselves.",
    'Chuck Norris can divide by zero.',
    'Chuck Norris writes to /dev/null and it remembers.',
    "Chuck Norris's queries don't need indexes. The rows come to him.",
    "Chuck Norris doesn't retry. It works the first time.",
    'Chuck Norris deploys on Friday.',
    "Chuck Norris's cache never misses.",
    'Race conditions wait for Chuck Norris.',
    'Chuck Norris gets exactly-once delivery.',
    "Chuck Norris doesn't read logs. Logs report to him.",
];

// A roundhouse kick lands on the right edge; the shock runs down the page and settles like a spring.
function roundhouse() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const swing = [0, -14, 9, -5, 2.5, -1, 0];
    const frames = swing.map((x, i) => ({
        transform: `translateX(${x}px) rotate(${x / 12}deg)`,
        offset: [0, 0.06, 0.24, 0.42, 0.6, 0.78, 1][i],
        easing: i ? 'ease-in-out' : 'cubic-bezier(.2, 0, 0, 1)',
    }));
    document.querySelectorAll('h1, canvas, .motto, h2, main p, tr, footer').forEach((el, i) =>
        el.animate(frames, { duration: 900, delay: i * 35 }));
}

function setupChuck(say: (text: string) => void) {
    console.log('%cwhat are you looking for?', 'font-weight: bold', '\ntry typing "chuck" anywhere on the website, or shake your phone.');
    const facts = FACTS.slice().sort(() => Math.random() - 0.5);
    let kicks = 0, typed = '';
    const kick = () => {
        roundhouse();
        say(facts[kicks++ % facts.length]);
    };

    addEventListener('keydown', (e) => {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        typed = (typed + e.key.toLowerCase()).slice(-5);
        if (typed === 'chuck') kick();
    });

    // Shake: a handful of hard jolts within a short window, then a cooldown.
    // ponytail: iOS only sends devicemotion after DeviceMotionEvent.requestPermission() from a tap, so there it stays silent.
    let jolts = 0, lastJolt = 0, quietUntil = 0;
    addEventListener('devicemotion', (e) => {
        const a = e.accelerationIncludingGravity;
        if (!a || a.x === null) return;
        const force = Math.abs(Math.hypot(a.x, a.y ?? 0, a.z ?? 0) - 9.81);
        const now = e.timeStamp;
        if (force < 12 || now < quietUntil) return;
        jolts = now - lastJolt < 500 ? jolts + 1 : 1;
        lastJolt = now;
        if (jolts < 6) return;
        jolts = 0;
        quietUntil = now + 2000;
        kick();
    });
}

/* ── boot ────────────────────────────────────────────────── */

const led = document.getElementById('led');
const say = led instanceof HTMLCanvasElement ? startLed(led, 'plumthedev') : () => {};

const built = document.getElementById('build-date');
if (built instanceof HTMLAnchorElement) {
    built.textContent = __BUILD_DATE__;
    built.title = __BUILD_COMMIT__.slice(0, 7);
    built.href = `https://github.com/plumthedev/plumthedev.cloud/commit/${__BUILD_COMMIT__}`;
}

document.getElementById('print')?.addEventListener('click', () => print());

setupAnalytics();
setupChuck(say);

if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
