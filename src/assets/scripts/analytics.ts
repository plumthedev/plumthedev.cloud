/* ── analytics (opt-out: on unless switched off) ─────────── */

function store(key: string, value?: string): string | null {
    try {
        if (value !== undefined) localStorage.setItem(key, value);
        return localStorage.getItem(key);
    } catch { return null; }
}

const GTM_ID = 'GTM-KH64L7ZR';

function loadGTM() {
    if (document.getElementById('gtm-loader')) return;
    const s = document.createElement('script');
    s.id = 'gtm-loader';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.append(s);
}

export function setupAnalytics() {
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
