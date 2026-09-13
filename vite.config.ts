import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import { readdirSync, readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => ({
    base: mode === 'pages' ? '/lego-spike-simulator/' : '/',
    plugins: [
        svelte(),
        // The single-file plugin forces a relative base; Pages needs its repository subpath.
        ...(mode === 'pages' ? [] : [viteSingleFile()]),
        {
            name: 'public-release-assets',
            generateBundle() {
                if (mode !== 'pages') return;
                const emitDirectory = (relative: string) => {
                    for (const entry of readdirSync(path.resolve('static', relative), {
                        withFileTypes: true
                    })) {
                        const fileName = `${relative}/${entry.name}`;
                        if (entry.isDirectory()) emitDirectory(fileName);
                        else if (entry.isFile())
                            this.emitFile({
                                type: 'asset',
                                fileName,
                                source: readFileSync(path.resolve('static', fileName))
                            });
                    }
                };
                // Deliberate allowlist: never publish personal samples or unreviewed mat/model files.
                for (const directory of ['blockly', 'icons', 'colours']) emitDirectory(directory);
                for (const file of ['lab-icon.svg', '404.html', 'robots.txt'])
                    this.emitFile({
                        type: 'asset',
                        fileName: file,
                        source: readFileSync(path.resolve('static', file), 'utf8')
                    });
                for (const file of ['COPYING.md', 'THIRD_PARTY_ASSETS.md'])
                    this.emitFile({ type: 'asset', fileName: file, source: readFileSync(file) });
                this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
            }
        }
    ],
    resolve: {
        alias: {
            $components: path.resolve(__dirname, './src/components'),
            $pages: path.resolve(__dirname, './src/pages'),
            $lib: path.resolve(__dirname, './src/lib')
        }
    },
    root: './',
    build: {
        outDir: 'dist'
    },
    publicDir: mode === 'pages' ? false : 'static'
}));
