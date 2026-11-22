const MENTION_START_BLOCKERS = /[\p{L}\p{N}_@.+\-`*~]/u;

export const isMentionStart = (text: string, atIndex: number): boolean => {
    const previousCharacter = text[atIndex - 1];

    return previousCharacter === undefined || !MENTION_START_BLOCKERS.test(previousCharacter);
};

export const isMentionQuery = (query: string): boolean => {
    return /^[a-z0-9]*$/i.test(query);
};
