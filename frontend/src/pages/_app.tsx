import App, { AppProps } from 'next/app';
import Head from 'next/head';
import Router from 'next/router';

import { Loading } from '@design-system';
import {
    TopNavigation,
    SEO,
} from '@components/integrated';

import { CONFIG } from '@modules/settings';
import {
    lazyLoadResource
} from '@modules/optimize/lazy';

import { loadingContext } from '@state/loading';

import '../styles/main.scss';

function minify(str: string) {
    str = str.replace(/\s/g, '');
    str = str.replace(/function/g, 'function ');
    str = str.replace(/var/g, 'var ');
    str = str.replace(/new/g, 'new ');
    return str;
}

Router.events.on('routeChangeStart', () => {

});
Router.events.on('routeChangeComplete', () => {
    lazyLoadResource();
});
Router.events.on('routeChangeError', () => {

});

class Main extends App<AppProps> {
    state = {
        isLoading: loadingContext.state.isLoading,
    }

    constructor(props: AppProps) {
        super(props);
        loadingContext.append((state) => {
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
                    {CONFIG.GOOGLE_ANALYTICS_V4 && (
                        <>
                            <script async src="https://www.googletagmanager.com/gtag/js?id=G-VD3ZLTR4ZQ"></script>
                            <script dangerouslySetInnerHTML={{ __html: minify(`
                                window.dataLayer = window.dataLayer || [];
                                function gtag() {
                                    dataLayer.push(arguments);
                                }
                                gtag('js', new Date());
                                gtag('config', '${CONFIG.GOOGLE_ANALYTICS_V4}');
                            `)}}/>
                        </>
                    )}
                    {CONFIG.MICROSOFT_CLARITY && (
                        <script dangerouslySetInnerHTML={{ __html: minify(`
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
                        `)}}/>
                    )}
                    {CONFIG.GOOGLE_ADSENSE_CLIENT_ID && (
                        <script
                            async
                            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
                        />
                    )}
                </Head>
                <SEO
                    title="BLEX"
                    image="https://static.blex.me/assets/images/default-post.png"
                    description="모든 글은 경험에서 나오고, 그 경험은 곧 당신이 됩니다. 당신의 경험을 빛나게 할 블로그."
                />

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