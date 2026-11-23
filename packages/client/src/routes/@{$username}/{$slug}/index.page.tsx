import { getDocumentLocale } from '../../../i18n/locale.js';
import { SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument, scriptJson } from '~/application/document';
import { postPageDataId } from '~/application/route-data';
import { PostPage } from '~/features/posts/post-page';
import { createPostPageData, type PostPageProps } from '~/features/posts/post-page-data';

export default function renderPage(props: PostPageProps): string {
    const { post, siteUrl, presentation, viewer, csrfToken, outline } = props;
    const data = createPostPageData(props);
    const { canonical, image, markdownUrl: markdown } = data;
    const authorUrl = new URL(data.authorPath, siteUrl).href;
    const imageAbsolute = image ? new URL(image, siteUrl).href : undefined;
    const published = data.published?.iso;
    const updated = data.updated?.iso;
    const robots =
        post.visibility !== 'public'
            ? 'noindex,nofollow,noarchive'
            : !presentation.seoEnabled
              ? 'noindex,nofollow'
              : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    const advertisesFeeds = post.visibility === 'public' && presentation.seoEnabled;
    const articleData =
        post.visibility === 'public'
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'BlogPosting',
                  mainEntityOfPage: {
                      '@type': 'WebPage',
                      '@id': canonical
                  },
                  headline: post.title,
                  description: post.description,
                  image: imageAbsolute,
                  author: {
                      '@type': 'Person',
                      name: post.username,
                      url: authorUrl
                  },
                  publisher: {
                      '@type': 'Organization',
                      name: presentation.siteName,
                      logo: {
                          '@type': 'ImageObject',
                          url: new URL(presentation.logoUrl ?? '/resources/logob.svg', siteUrl).href
                      }
                  },
                  datePublished: published,
                  dateModified: updated,
                  keywords: presentation.tags.length ? presentation.tags.join(', ') : undefined,
                  articleSection: presentation.seriesName ?? 'Blog'
              }
            : null;

    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <title>{`${post.title} - ${post.username} | ${presentation.siteName}`}</title>
                <meta name="description" content={post.description} />
                <meta name="author" content={post.username} />
                <meta name="robots" content={robots} />
                <meta name="googlebot" content={robots} />
                {presentation.tags.length > 0 && <meta name="keywords" content={presentation.tags.join(', ')} />}
                <meta property="og:type" content="article" />
                <meta property="og:title" content={post.title} />
                <meta property="og:description" content={post.description} />
                <meta property="og:url" content={canonical} />
                {imageAbsolute && <meta property="og:image" content={imageAbsolute} />}
                <meta property="article:published_time" content={published} />
                <meta property="article:modified_time" content={updated} />
                <meta property="article:author" content={authorUrl} />
                {presentation.tags.map((tag) => (
                    <meta key={tag} property="article:tag" content={tag} />
                ))}
                <meta name="twitter:card" content={imageAbsolute ? 'summary_large_image' : 'summary'} />
                <meta name="twitter:title" content={post.title} />
                <meta name="twitter:description" content={post.description} />
                {imageAbsolute && <meta name="twitter:image" content={imageAbsolute} />}
                <link rel="icon" href={presentation.faviconUrl} />
                <link rel="canonical" href={canonical} />
                {markdown && <link rel="alternate" type="text/markdown" href={markdown} />}
                {advertisesFeeds && (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={`${presentation.siteName} RSS`}
                        href={new URL('/rss', siteUrl).href}
                    />
                )}
                {advertisesFeeds && (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={`${post.username} RSS`}
                        href={new URL(`/rss/@${encodeURIComponent(post.username)}`, siteUrl).href}
                    />
                )}
                {articleData && (
                    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(articleData) }} />
                )}
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased selection:bg-action selection:text-content-inverted">
                <SiteHeader
                    brand={presentation}
                    viewer={
                        viewer
                            ? {
                                  ...viewer,
                                  csrfToken
                              }
                            : null
                    }
                />
                <PostPage data={data} bodyHtml={outline.html} />
                <script
                    type="application/json"
                    id={postPageDataId}
                    dangerouslySetInnerHTML={{ __html: scriptJson(data) }}
                />
            </body>
        </html>,
        'tree'
    );
}
