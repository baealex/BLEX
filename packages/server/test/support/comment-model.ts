import { commentModel } from '../../src/platform/views.js';

export const { appendCommentToTree, buildReplySubmissionText, commentAuthors, countComments, findRootParentId, isMentionQuery, isMentionStart, mergeCommentInTree } = commentModel;
