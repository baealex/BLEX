import { renderPage } from '../../platform/views.js';
import type { HeaderViewer } from '../../platform/views.js';
import { postOutline, youtubeFrameSources } from './post-html.js';
import type { PostPresentation, PublicPost } from './public-post.js';
import type { RelatedPost } from '../authors/public-activity.js';
import type { ReaderPostView } from '../engagement/index.js';
export const postContentSecurityPolicy = `default-src 'none'; img-src 'self' https: data:; media-src 'self' https:; frame-src ${youtubeFrameSources}; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;

export function renderPublicPostPage(
  post: PublicPost,
  presentation: PostPresentation,
  siteUrl: URL,
  reader: ReaderPostView | null = null,
  csrfToken = '',
  canManage = false,
  viewer: HeaderViewer | null = null,
  related: RelatedPost[] = [],
  previewAuthor?: { bio: string; homepage: string },
  hasTimelapse = false,
): string {
  return renderPage('@{$username}/{$slug}/index', {
    post,
    siteUrl,
    presentation,
    hasTimelapse,
    viewer,
    csrfToken,
    canManage,
    reader,
    previewAuthor,
    related,
    outline: postOutline(post.contentHtml),
  });
}
