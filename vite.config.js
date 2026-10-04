import { resolve } from 'path'
import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import { ViteMinifyPlugin } from 'vite-plugin-minify'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

// The CSS and JS are a few KB: inline them into the page so it is one request and nothing blocks the first render.
const inlineAssets = {
    name: 'inline-assets',
    enforce: 'post',
    generateBundle(_, bundle) {
        const html = bundle['index.html'];
        for (const [name, file] of Object.entries(bundle)) {
            const tag = (el) => new RegExp(`<${el}[^>]*${name.replace(/\./g, '\\.')}[^>]*>${el === 'script' ? '</script>' : ''}`);
            if (name.endsWith('.css')) html.source = html.source.replace(tag('link'), () => `<style>${file.source}</style>`);
            else if (file.type === 'chunk') html.source = html.source.replace(tag('script'), () => `<script type="module">${file.code}</script>`);
            else continue;
            delete bundle[name];
        }
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
            output: {
                inlineDynamicImports: false,
            },
            input: {
                main: resolve(__dirname, 'src/index.html'),
            },
        }
    },
})
