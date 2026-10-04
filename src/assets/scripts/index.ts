/// <reference types="vite/client" />
import { startLed } from './led';
import { setupAnalytics } from './analytics';
import { setupChuck } from './chuck';

declare const __BUILD_DATE__: string;
declare const __BUILD_COMMIT__: string;

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
setupChuck(say, led);

if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
