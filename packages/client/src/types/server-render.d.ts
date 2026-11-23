// Server-rendered views run in Node.js; the browser bundles never import these modules.
declare module 'node:crypto' {
    export function createHash(algorithm: string): {
        update(data: string): { digest(encoding: 'hex'): string };
    };
}

declare const process: { env: Record<string, string | undefined> };
