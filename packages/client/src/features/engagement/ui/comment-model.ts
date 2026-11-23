import type { CommentPayload } from '../../../contracts/engagement';

const mentionStartBlockers = /[\p{L}\p{N}_@.+\-`*~]/u;
const replyMentionSeparator = /[\s,!?;:()[\]{}]/;

export function isMentionStart(text: string, atIndex: number): boolean {
    const previous = text[atIndex - 1];
    return previous === undefined || !mentionStartBlockers.test(previous);
}

export function isMentionQuery(query: string): boolean {
    return /^[a-z0-9]*$/i.test(query);
}

function isMentionBoundary(text: string, index: number): boolean {
    const next = text[index];
    if (next === undefined) return true;
    if (next === '.') {
        const afterDot = text[index + 1];
        return afterDot === undefined || !/[a-z0-9]/i.test(afterDot);
    }
    return replyMentionSeparator.test(next);
}

/** Replies stay one level deep, so a reply to a reply names its target with a mention. */
export function buildReplySubmissionText(replyText: string, targetAuthor: string | null): string {
    const content = replyText.trim();
    if (!targetAuthor) return content;
    const mention = `@${targetAuthor}`;
    if (content === mention || (content.startsWith(mention) && isMentionBoundary(content, mention.length)))
        return content;
    return content ? `${mention} ${content}` : mention;
}

export function updateCommentInTree(
    comments: CommentPayload[],
    commentId: number,
    updater: (comment: CommentPayload) => CommentPayload
): CommentPayload[] {
    return comments.map((comment) => {
        if (comment.id === commentId) return updater(comment);
        if (!comment.replies?.length) return comment;
        return {
            ...comment,
            replies: updateCommentInTree(comment.replies, commentId, updater)
        };
    });
}

export function mergeCommentInTree(comments: CommentPayload[], updated: CommentPayload): CommentPayload[] {
    return updateCommentInTree(comments, updated.id, (comment) => ({
        ...comment,
        ...updated,
        replies: updated.replies ?? comment.replies
    }));
}

export function appendCommentToTree(comments: CommentPayload[], created: CommentPayload): CommentPayload[] {
    const entry = {
        ...created,
        replies: created.replies ?? []
    };
    if (!created.parentId) return [...comments, entry];
    return updateCommentInTree(comments, created.parentId, (comment) => ({
        ...comment,
        replies: [...(comment.replies ?? []), entry]
    }));
}

export function findRootParentId(commentId: number, comments: CommentPayload[]): number {
    for (const comment of comments) {
        if (comment.id === commentId || comment.replies?.some((reply) => reply.id === commentId)) return comment.id;
    }
    return commentId;
}

export function commentAuthors(comments: CommentPayload[]): string[] {
    const authors = new Set<string>();
    const collect = (list: CommentPayload[]) => {
        for (const comment of list) {
            if (comment.author && !comment.isDeleted) authors.add(comment.author);
            if (comment.replies?.length) collect(comment.replies);
        }
    };
    collect(comments);
    return [...authors].sort();
}

export function countComments(comments: CommentPayload[]): number {
    return comments.reduce((total, comment) => total + 1 + countComments(comment.replies ?? []), 0);
}
