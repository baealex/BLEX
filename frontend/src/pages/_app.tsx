import App, { AppProps } from 'next/app';
import Head from 'next/head';
import Router from 'next/router';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import {
    SEO,
    CornerLoading,
    TopNavigation,
} from '@components/shared';

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
    loadingContext.setState({
        isLoading: true,
    });
});
Router.events.on('routeChangeComplete', () => {
    lazyLoadResource();
    loadingContext.setState({
        isLoading: false,
    });
});
Router.events.on('routeChangeError', () => {
    loadingContext.setState({
        isLoading: false,
    });
});

class Main extends App<AppProps> {
    state = {
        isLoading: loadingContext.state.isLoading,
    }

    constructor(props: AppProps) {
        super(props);
        loadingContext.appendUpdater((state) => {
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
                </Head>
                <SEO
                    title="BLEX"
                    image="https://static.blex.me/assets/images/default-post.png"
                    description="경험이 글을 만들고 글이 나를 만든다. 나를 표현하는 블렉스"
                />

                <TopNavigation/>
                <CornerLoading/>
                
                <div className="content">
                    {getLayout(<Component {...pageProps}/>, pageProps)}
                </div>

                <ToastContainer/>
            </>
        )
    }
}

export default Main;