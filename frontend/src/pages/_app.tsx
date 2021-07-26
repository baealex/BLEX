import App, { AppProps } from 'next/app';
import Head from 'next/head';
import Router from 'next/router';

import '../styles/main.scss';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

import { CONFIG } from '@modules/settings';
import {
    lazyLoadResource
} from '@modules/lazy';

function minify(str: string) {
    str = str.replace(/\s/g, '');
    str = str.replace(/function/g, 'function ');
    str = str.replace(/var/g, 'var ');
    str = str.replace(/new/g, 'new ');
    return str;
}

Router.events.on('routeChangeStart', () => NProgress.start());
Router.events.on('routeChangeComplete', () => {
    NProgress.done();
    lazyLoadResource();
});
Router.events.on('routeChangeError', () => NProgress.done());

import { SEO, TopNavigation } from '@components/shared';

class Main extends App<AppProps> {
    constructor(props: AppProps) {
        super(props);
    }

    componentDidMount() {
        lazyLoadResource();
    }

    render() {
        const {Component, pageProps} = this.props;

        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                    <link rel="icon" href="/favicon.ico"/>
                    <link rel="apple-touch-icon" sizes="57x57" href="/logo57.png"/>
                    <link rel="apple-touch-icon" sizes="72x72" href="/logo72.png"/>
                    <link rel="apple-touch-icon" sizes="76x76" href="/logo76.png"/>
                    <link rel="apple-touch-icon" sizes="114x114" href="/logo114.png"/>
                    <link rel="apple-touch-icon" sizes="120x120" href="/logo120.png"/>
                    <link rel="apple-touch-icon" sizes="144x144" href="/logo144.png"/>
                    <link rel="apple-touch-icon" sizes="152x152" href="/logo152.png"/>
                    <link rel="icon" type="image/png" sizes="16x16" href="/logo16.png"/>
                    <link rel="icon" type="image/png" sizes="32x32" href="/logo32.png"/>
                    <link rel="icon" type="image/png" sizes="96x96" href="/logo96.png"/>
                    <link rel="icon" type="image/png" sizes="192x192" href="/logo192.png"/>
                    <meta name="theme-color" content="#000"/>
                    <meta name="application-name" content="BLEX"/>
                    <meta name="msapplication-TileImage" content="/logo144.png"/>
                    <meta name="msapplication-TileColor" content="#000"/>
                    <link
                        rel="stylesheet"
                        href="https://use.fontawesome.com/releases/v5.0.13/css/all.css"
                        integrity="sha384-DNOHZ68U8hZfKXOrtjWvjxusGo9WQnrNx2sqG0tfsghAvtVlRW3tvkXWZh58N9jp"
                        crossOrigin="anonymous"/>
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
                    title={'BLOG EXPRESS ME'}
                    description={'경험이 글을 만들고 글이 나를 만든다. 나를 표현하는 블렉스'}
                    image={'https://static.blex.me/assets/images/default-post.png'}
                />

                <TopNavigation/>
                
                <div className="content">
                    <Component {...pageProps}/>
                </div>

                <ToastContainer/>
            </>
        )
    }
}

export default Main;