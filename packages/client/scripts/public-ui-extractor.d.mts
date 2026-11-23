import type { babelExtractor } from '@lingui/cli/api/extractors/babel';

export function extractPublicMessages(filename: string, code: string): Array<{
    id: string;
    message: string;
    origin: [string, number, number];
}>;

declare const extractor: typeof babelExtractor;
export default extractor;
