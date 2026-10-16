import { defineConfig } from 'tsup';

export default defineConfig( {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    // Stylesheets are real .css files that end up inlined as strings.
    loader: { '.css': 'text' }
} );
