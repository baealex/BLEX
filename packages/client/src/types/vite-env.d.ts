/// <reference types="vite/client" />

declare module '*.po' {
    import type { Messages } from '@lingui/core';

    export const messages: Messages;
}

declare module '*.po?lingui' {
    import type { Messages } from '@lingui/core';

    export const messages: Messages;
}

declare module '*.po?developer?lingui' {
    import type { Messages } from '@lingui/core';

    export const messages: Messages;
}
