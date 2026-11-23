import type { ReactElement } from 'react';
import type { CommentPayload, ReaderPostView } from '@blex/contracts/engagement';

// Tests reach into the client's server-rendering build for the few views they assert on directly.
interface ClientViews {
  renderApplicationDocument(page: ReactElement, hydrateContent?: boolean): string;
  opensOutsideApplication(response: { ok: boolean; redirected: boolean }, isApplicationPage: boolean): boolean;
  SiteHeader(props: {
    viewer?: {
      username?: string;
      hasEditorRole?: boolean;
      isStaff?: boolean;
      csrfToken?: string;
      unreadCount?: number;
    };
  }): ReactElement;
  SiteTheme(): ReactElement;
  ReaderActions(props: { view: ReaderPostView; csrfToken: string; returnTo?: string }): ReactElement;
  commentModel: {
    isMentionStart(text: string, atIndex: number): boolean;
    isMentionQuery(query: string): boolean;
    buildReplySubmissionText(replyText: string, targetAuthor: string | null): string;
    appendCommentToTree(comments: CommentPayload[], created: CommentPayload): CommentPayload[];
    mergeCommentInTree(comments: CommentPayload[], updated: CommentPayload): CommentPayload[];
    mergeOlderComments(current: CommentPayload[], older: CommentPayload[]): CommentPayload[];
    findRootParentId(commentId: number, comments: CommentPayload[]): number;
    commentAuthors(comments: CommentPayload[]): string[];
    countComments(comments: CommentPayload[]): number;
  };
}

const views: ClientViews = await import(new URL('../../ssr/entry-server.js', import.meta.url).href);

export const { renderApplicationDocument, opensOutsideApplication, SiteHeader, SiteTheme, commentModel } = views;
