import { commentModel } from './client-views.js';

export const { appendCommentToTree, buildReplySubmissionText, commentAuthors, countComments, findRootParentId, isMentionQuery, isMentionStart, mergeCommentInTree } = commentModel;
