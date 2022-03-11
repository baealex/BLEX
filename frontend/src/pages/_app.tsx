import App, { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import Router from 'next/router';

import { Loading } from '@design-system';
import {
    TopNavigation,
    SEO,
} from '@system-design/shared';

import { CONFIG } from '@modules/settings';
import {
    lazyLoadResource
} from '@modules/optimize/lazy';
import {
    minify
} from '@modules/utility/string';

import { loadingStore } from '@stores/loading';

import '../styles/main.scss';

Router.events.on('routeChangeComplete', () => {
    lazyLoadResource();
});

class Main extends App<AppProps> {
    state = {
        isLoading: loadingStore.state.isLoading,
    }

    constructor(props: AppProps) {
        super(props);
        loadingStore.subscribe((state) => {
            this.setState({
                isLoading: state.isLoading,
            });
        })
    }

    componentDidMount() {
        lazyLoadResource();
    }

    render() {
        const { Component, pageProps } = this.props;
        
        const getLayout = (page: JSX.Element, props: Object) => {
            if ((Component as any).pageLayout) {
                return (Component as any).pageLayout(page, props);
            }
            return page;
        };

        return (
            <>
                <Head>
                    <title>BLEX</title>
                </Head>

                <SEO
                    title="BLEX"
                    image="https://static.blex.me/assets/images/default-post.png"
                    description="모든 글은 경험에서 나오고, 그 경험은 곧 당신이 됩니다. 당신의 경험을 빛나게 할 블로그."
                />

                {CONFIG.GOOGLE_ANALYTICS_V4 && (
                    <>
                        <Script src={`https://www.googletagmanager.com/gtag/js?id=${CONFIG.GOOGLE_ANALYTICS_V4}`}/>
                        <Script
                            id="gtag-init"
                            dangerouslySetInnerHTML={{ __html: minify(`
                                window.dataLayer = window.dataLayer || [];
                                function gtag() {
                                    dataLayer.push(arguments);
                                }
                                gtag('js', new Date());
                                gtag('config', '${CONFIG.GOOGLE_ANALYTICS_V4}');
                            `)}}
                        />
                    </>
                )}
                {CONFIG.MICROSOFT_CLARITY && (
                    <Script
                        id="clarity-init"
                        dangerouslySetInnerHTML={{ __html: minify(`
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
                        `)}}
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
                    {getLayout(<Component {...pageProps}/>, pageProps)}
                </div>
            </>
        )
    }
}

export default Main;