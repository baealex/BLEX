import App, { AppProps } from 'next/app';
import Head from 'next/head';
import Router from 'next/router';

import {
    Loading,
    TopNavigation,
    SEO,
} from '@components/integrated';

import { CONFIG } from '@modules/settings';
import {
    lazyLoadResource
} from '@modules/lazy';

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
                    <title>BLOG EXPRESS ME</title>
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
                    description="경험은 글이 되고 글은 나를 표현한다. 나를 표현하는 블렉스"
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