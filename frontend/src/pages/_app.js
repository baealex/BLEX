import App from 'next/app'
import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/main.scss'

import Router from 'next/router';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

Router.events.on('routeChangeStart', () => NProgress.start());
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

import TopNavagation from '../components/common/TopNavigation'

class Main extends App {
    render() {
        const {Component, pageProps} = this.props;

        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                    <link rel="icon" href="/favicon.ico" />
                    <link
                        rel="stylesheet"
                        href="https://use.fontawesome.com/releases/v5.0.13/css/all.css"
                        integrity="sha384-DNOHZ68U8hZfKXOrtjWvjxusGo9WQnrNx2sqG0tfsghAvtVlRW3tvkXWZh58N9jp"
                        crossOrigin="anonymous"/>
                    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Noto+Serif+KR|Noto+Sans+KR|Black+Han+Sans"/>
                    <link
                        rel="stylesheet"
                        href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css"
                        integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk"
                        crossOrigin="anonymous"
                    />
                </Head>

                <TopNavagation/>

                <div className="content">
                    <Component {...pageProps}/>
                </div>

                <footer className="page-footer font-small bg-rdark">
                    <div className="footer-copyright text-center py-3">
                        Copyright 2020 &copy; <a href="https://baejino.com">BaeJino</a>.
                    </div>
                </footer>

                <style jsx>{`${styles}`}</style>
            </>
        )
    }
}

export default Main