import App, { AppProps } from 'next/app';
import Head from 'next/head';
import Router from 'next/router';
import Script from 'next/script';

import {
    DayNight,
    SEO,
    TopNavigation
} from '@system-design/shared';
import type { PageComponent, PageLayout } from '~/components';
import { Loading } from '@design-system';

import { CONFIG } from '~/modules/settings';
// import { bindErrorReport } from '~/modules/utility/report';
import { lazyLoadResource } from '~/modules/optimize/lazy';
import { minify } from '~/modules/utility/string';

import { loadingStore } from '~/stores/loading';

import '../styles/main.scss';
import 'easymde/src/css/easymde.css';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material-darker.css';

Router.events.on('routeChangeComplete', () => {
    lazyLoadResource();
});

class Main extends App<AppProps> {
    state = { isLoading: loadingStore.state.isLoading };

    constructor(props: AppProps) {
        super(props);
        loadingStore.subscribe((state) => {
            this.setState({ isLoading: state.isLoading });
        });
    }

    componentDidMount() {
        // bindErrorReport();
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
                <Head>
                    <meta name="referrer" content="origin"/>
                </Head>

                <SEO
                    title="BLEX"
                    image="https://static.blex.me/assets/images/default-post.png"
                    description={[
                        '누구나 경험과 지식을 공유할 수 있는 블로그 플랫폼입니다.',
                        '마크다운으로 글을 작성할 수 있으며 코드 강조 표시, 수식, 이미지 삽입 등을 지원합니다.',
                        '방문자가 내 포스트를 언제, 어디서, 어떻게 찾는지 분석할 수 있습니다.',
                        '단순한 디자인으로 사용자가 우리의 경험을 보다 쉽게 탐색할 수 있습니다.'
                    ].join(' ')}
                />

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

                <main role="main" className="content">
                    {getLayout(<Component {...pageProps}/>, pageProps)}
                </main>

                <DayNight/>
            </>
        );
    }
}

export default Main;
