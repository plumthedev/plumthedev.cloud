import { resolve } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { defineConfig } from 'vite'
import { ViteMinifyPlugin } from 'vite-plugin-minify'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

// The CSS and JS are a few KB: inline them into the page so it is one request and nothing blocks the first render.
// A CSP then allows exactly those inline blocks (by hash), GTM and GA4, and nothing else.
// GitHub Pages can't send headers, so it goes in a <meta>; frame-ancestors doesn't work there.
const sha = (code) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
const GA = 'https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com';

const inlineAssets = {
    name: 'inline-assets',
    enforce: 'post',
    generateBundle(_, bundle) {
        const html = bundle['index.html'];
        const hashes = { script: [], style: [] };
        for (const [name, file] of Object.entries(bundle)) {
            const tag = (el) => new RegExp(`<${el}[^>]*${name.replace(/\./g, '\\.')}[^>]*>${el === 'script' ? '</script>' : ''}`);
            if (name.endsWith('.css')) {
                html.source = html.source.replace(tag('link'), () => `<style>${file.source}</style>`);
                hashes.style.push(sha(file.source));
            } else if (file.type === 'chunk') {
                html.source = html.source.replace(tag('script'), () => `<script type="module">${file.code}</script>`);
                hashes.script.push(sha(file.code));
            } else continue;
            delete bundle[name];
        }
        const csp = [
            "default-src 'self'",
            `script-src 'self' ${hashes.script.join(' ')} https://www.googletagmanager.com`,
            `style-src ${hashes.style.join(' ')}`,
            `img-src 'self' ${GA}`,
            `connect-src 'self' ${GA}`,
            "base-uri 'none'",
            "object-src 'none'",
            "form-action 'none'",
        ].join('; ');
        html.source = html.source.replace('<meta charset="UTF-8">', (m) => `${m}<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
};

export default defineConfig({
    root: 'src',
    define: {
        __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
        __BUILD_COMMIT__: JSON.stringify(execSync('git rev-parse HEAD').toString().trim()),
    },
    plugins: [
        ViteMinifyPlugin({}),
        ViteImageOptimizer(),
        inlineAssets,
    ],
    build: {
        minify: true,
        modulePreload: { polyfill: false },
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(import.meta.dirname, 'src/index.html'),
            },
        }
    },
})
