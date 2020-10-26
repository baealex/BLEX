import App from 'next/app'
import Head from 'next/head'
import styles from '../styles/main.scss'

import Router from 'next/router';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

typeof window !== "undefined" && require('codemirror/lib/codemirror.css');
typeof window !== "undefined" && require('codemirror/theme/material-darker.css');
typeof window !== "undefined" && require('codemirror/mode/markdown/markdown');

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
                <ToastContainer/>

                <div className="content">
                    <Component {...pageProps}/>
                </div>

                <style jsx>{`${styles}`}</style>
            </>
        )
    }
}

export default Main