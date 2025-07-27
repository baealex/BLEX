import Head from 'next/head';

export interface SEOProps {
    title?: string;
    author?: string;
    description?: string;
    keywords?: string[];
    url?: string;
    image?: string;
    imageAlt?: string;
    publishedTime?: string;
    modifiedTime?: string;
    siteName?: string;
    locale?: string;
    type?: 'website' | 'article' | 'blog' | 'profile';
    twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
    twitterSite?: string;
    twitterCreator?: string;
    canonicalUrl?: string;
    noIndex?: boolean;
    noFollow?: boolean;
    themeColor?: string;
    favicon?: string;
    alternateUrls?: Array<{ hrefLang: string; href: string }>;
    structuredData?: Record<string, unknown>;
}

export function SEO({
    title,
    author,
    description,
    keywords = [],
    url,
    image,
    imageAlt,
    publishedTime,
    modifiedTime,
    siteName = 'BLEX',
    locale = 'ko_KR',
    type = 'website',
    twitterCard = 'summary_large_image',
    twitterSite,
    twitterCreator,
    canonicalUrl,
    noIndex = false,
    noFollow = false,
    themeColor = '#ffffff',
    favicon = '/favicon.ico',
    alternateUrls = [],
    structuredData
}: SEOProps) {
    // Basic meta tags
    const basicTags = [
        // Standard meta tags
        title && <title key="title">{title}</title>,
        title && <meta key="title-meta" name="title" content={title} />,
        description && <meta key="description" name="description" content={description} />,
        author && <meta key="author" name="author" content={author} />,
        keywords.length > 0 && <meta key="keywords" name="keywords" content={keywords.join(', ')} />,

        // Robots
        <meta key="robots" name="robots" content={`${noIndex ? 'noindex' : 'index'}, ${noFollow ? 'nofollow' : 'follow'}`} />,

        // Theme color
        <meta key="theme-color" name="theme-color" content={themeColor} />,

        // Favicon
        <link key="favicon" rel="icon" href={favicon} />,

        // Canonical URL
        canonicalUrl && <link key="canonical" rel="canonical" href={canonicalUrl} />
    ].filter(Boolean);

    // Open Graph meta tags
    const ogTags = [
        // Basic OG tags
        <meta key="og:type" property="og:type" content={type} />,
        title && <meta key="og:title" property="og:title" content={title} />,
        description && <meta key="og:description" property="og:description" content={description} />,
        url && <meta key="og:url" property="og:url" content={url} />,
        siteName && <meta key="og:site_name" property="og:site_name" content={siteName} />,
        <meta key="og:locale" property="og:locale" content={locale} />,

        // OG image tags
        image && <meta key="og:image" property="og:image" content={image} />,
        image && imageAlt && <meta key="og:image:alt" property="og:image:alt" content={imageAlt} />,
        image && <meta key="og:image:width" property="og:image:width" content="1200" />,
        image && <meta key="og:image:height" property="og:image:height" content="630" />,

        // Article specific OG tags
        (type === 'article' || type === 'blog') && publishedTime && (
            <meta key="article:published_time" property="article:published_time" content={publishedTime} />
        ),
        (type === 'article' || type === 'blog') && modifiedTime && (
            <meta key="article:modified_time" property="article:modified_time" content={modifiedTime} />
        ),
        (type === 'article' || type === 'blog') && author && (
            <meta key="article:author" property="article:author" content={author} />
        )
    ].filter(Boolean);

    // Twitter meta tags
    const twitterTags = [
        <meta key="twitter:card" name="twitter:card" content={twitterCard} />,
        title && <meta key="twitter:title" name="twitter:title" content={title} />,
        description && <meta key="twitter:description" name="twitter:description" content={description} />,
        twitterSite && <meta key="twitter:site" name="twitter:site" content={twitterSite} />,
        twitterCreator && <meta key="twitter:creator" name="twitter:creator" content={twitterCreator} />,
        image && <meta key="twitter:image" name="twitter:image" content={image} />,
        image && imageAlt && <meta key="twitter:image:alt" name="twitter:image:alt" content={imageAlt} />
    ].filter(Boolean);

    // Alternate language URLs
    const alternateTags = alternateUrls.map((alt, index) => (
        <link
            key={`alternate-${index}`}
            rel="alternate"
            hrefLang={alt.hrefLang}
            href={alt.href}
        />
    ));

    // JSON-LD structured data
    const structuredDataTag = structuredData ? [
        <script
            key="structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
    ] : [];

    return (
        <Head>
            {basicTags}
            {ogTags}
            {twitterTags}
            {alternateTags}
            {structuredDataTag}
        </Head>
    );
}
