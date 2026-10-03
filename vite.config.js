import { resolve } from 'path'
import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import { ViteMinifyPlugin } from 'vite-plugin-minify'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
    root: 'src',
    define: {
        __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
        __BUILD_COMMIT__: JSON.stringify(execSync('git rev-parse HEAD').toString().trim()),
    },
    plugins: [
        ViteMinifyPlugin({}),
        ViteImageOptimizer(),
    ],
    build: {
        minify: true,
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                inlineDynamicImports: false,
            },
            input: {
                main: resolve(__dirname, 'src/index.html'),
                protocol: resolve(__dirname, 'src/protocol-c.html'),
            },
        }
    },
})
