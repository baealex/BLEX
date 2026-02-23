import { defineConfig } from 'tsup';
import { globSync } from 'glob';

export default defineConfig({
    entry: globSync('src/*.ts').sort(),
    format: ['cjs', 'esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom']
});
