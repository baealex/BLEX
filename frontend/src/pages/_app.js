import App from 'next/app';
import Head from 'next/head';
import Router from 'next/router';

import styles from '../styles/main.scss';

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

import LibHead from '../components/common/LibHead';
import TopNavagation from '../components/common/TopNavigation';

class Main extends App {
    render() {
        const {Component, pageProps} = this.props;

        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                    <link rel="icon" href="/favicon.ico" />
                </Head>
                <LibHead/>

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