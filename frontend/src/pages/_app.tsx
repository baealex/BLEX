import App, { AppProps } from 'next/app';
import Head from 'next/head';
import Router from 'next/router';
import Script from 'next/script';

import { ArticleDetailSkeleton, ArticleListSkeleton } from '@components/design-system/skeleton';
import type {
    PageComponent,
    PageLayout
} from '@components';
import {
    SEO,
    TopNavigation
} from '@system-design/shared';
import { Loading } from '@design-system';

import { CONFIG } from '@modules/settings';
import { bindErrorReport } from '@modules/utility/report';
import { lazyLoadResource } from '@modules/optimize/lazy';
import { minify } from '@modules/utility/string';

import { loadingStore } from '@stores/loading';

import '../styles/main.scss';
import 'react-loading-skeleton/dist/skeleton.css';

bindErrorReport();

Router.events.on('routeChangeStart', (path = '') => {
    path = path.replace(/\?.*/, '') as string;
    let SkeletonUI = undefined;

    if (path === '/' || path === '/newest' || path.startsWith('/tags/')) {
        SkeletonUI = <ArticleListSkeleton />;
    }

    if (path.match(/\/@[^/]*\/[^/]*/) && !path.endsWith('/') && !path.includes('posts') && !path.includes('series') && !path.includes('about')) {
        SkeletonUI = <ArticleDetailSkeleton />;
    }

    loadingStore.set({
        isRoute: true,
        SkeletonUI
    });
});

Router.events.on('routeChangeComplete', () => {
    loadingStore.set({
        isRoute: false,
        SkeletonUI: undefined
    });
    lazyLoadResource();
});

class Main extends App<AppProps> {
    state = { ...loadingStore.state };

    constructor(props: AppProps) {
        super(props);
        loadingStore.subscribe((state) => {
            this.setState({ ...state });
        });
    }

    componentDidMount() {
        lazyLoadResource();
    }

    render() {
        const {
            Component,
            pageProps
        } = this.props;

        const getLayout: PageLayout<typeof pageProps> = (page, props) => {
            const pageComponent = Component as PageComponent<typeof props>;

            if (pageComponent.pageLayout) {
                return pageComponent.pageLayout(page, props);
            }

            return page;
        };

        return (
            <>
                <SEO
                    title="BLEX"
                    image="https://static.blex.me/assets/images/default-post.png"
                    description="모든 글은 경험에서 나오고, 그 경험은 곧 당신이 됩니다. 당신의 경험을 빛나게 할 블로그"
                />

                <Head>
                    <meta name="referrer" content="origin"/>
                </Head>

                {CONFIG.GOOGLE_ANALYTICS_V4 && (
                    <>
                        <Script src={`https://www.googletagmanager.com/gtag/js?id=${CONFIG.GOOGLE_ANALYTICS_V4}`}/>
                        <Script
                            id="gtag-init"
                            dangerouslySetInnerHTML={{
                                __html: minify(`
                                window.dataLayer = window.dataLayer || [];
                                function gtag() {
                                    dataLayer.push(arguments);
                                }
                                gtag('js', new Date());
                                gtag('config', '${CONFIG.GOOGLE_ANALYTICS_V4}');
                            `)
                            }}
                        />
                    </>
                )}
                {CONFIG.MICROSOFT_CLARITY && (
                    <Script
                        id="clarity-init"
                        dangerouslySetInnerHTML={{
                            __html: minify(`
                            (function(c, l, a, r, i, t, y) {
                                c[a] = c[a] || function() {
                                    (c[a].q = c[a].q || []).push(arguments)
                                };
                                t = l.createElement(r);
                                t.async = 1;
                                t.src = "https://www.clarity.ms/tag/" + i;
                                y = l.getElementsByTagName(r)[0];
                                y.parentNode.insertBefore(t,y);
                            })(window, document, "clarity", "script", "${CONFIG.MICROSOFT_CLARITY}");
                        `)
                        }}
                    />
                )}
                {CONFIG.GOOGLE_ADSENSE_CLIENT_ID && (
                    <Script
                        async
                        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
                    />
                )}

                <TopNavigation/>

                {this.state.isLoading && (
                    <Loading/>
                )}

                <div className="content">
                    {this.state.SkeletonUI && this.state.isRoute ? (
                        this.state.SkeletonUI
                    ) : (
                        getLayout(<Component {...pageProps}/>, pageProps)
                    )}
                </div>
            </>
        );
    }
}

export default Main;
