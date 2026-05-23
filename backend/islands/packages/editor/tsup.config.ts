import { defineConfig } from 'tsup';
import { globSync } from 'glob';

const isWatch = process.argv.includes('--watch');

export default defineConfig({
    entry: globSync('src/*.ts', { posix: true }).sort(),
    format: ['cjs', 'esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: !isWatch,
    external: ['react', 'react-dom']
});
