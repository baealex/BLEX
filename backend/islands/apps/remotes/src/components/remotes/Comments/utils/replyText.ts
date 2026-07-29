const REPLY_MENTION_SEPARATOR = /[\s,!?;:()[\]{}]/;

const isMentionBoundary = (text: string, index: number): boolean => {
    const nextCharacter = text[index];

    if (nextCharacter === undefined) {
        return true;
    }

    if (nextCharacter === '.') {
        const characterAfterDot = text[index + 1];
        return characterAfterDot === undefined || !/[a-z0-9]/i.test(characterAfterDot);
    }

    return REPLY_MENTION_SEPARATOR.test(nextCharacter);
};

export const buildReplySubmissionText = (
    replyText: string,
    replyTargetAuthor: string | null
): string => {
    const content = replyText.trim();

    if (!replyTargetAuthor) {
        return content;
    }

    const mentionPrefix = `@${replyTargetAuthor}`;
    const alreadyMentionsTarget = content === mentionPrefix || (
        content.startsWith(mentionPrefix)
        && isMentionBoundary(content, mentionPrefix.length)
    );

    if (alreadyMentionsTarget) {
        return content;
    }

    return content ? `${mentionPrefix} ${content}` : mentionPrefix;
};
