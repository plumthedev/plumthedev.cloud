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

export function setupChuck(say: (text: string) => void, logo: HTMLElement | null) {
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

    logo?.addEventListener('click', kick);

    // Holding the copyright line on a phone. Scrolling cancels the pointer, and with it the timer.
    const copy = document.querySelector<HTMLElement>('.copy');
    let hold = 0;
    const release = () => clearTimeout(hold);
    copy?.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') hold = setTimeout(kick, 600);
    });
    copy?.addEventListener('pointerup', release);
    copy?.addEventListener('pointercancel', release);
    copy?.addEventListener('contextmenu', (e) => e.preventDefault());
}
