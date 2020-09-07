import App from 'next/app'
import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/main.scss'

import TopNavagation from '../components/common/TopNavigation'

class Main extends App {
    render() {
        const {Component, pageProps} = this.props;

        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                    <link rel="icon" href="/favicon.ico" />
                    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.13/css/all.css" integrity="sha384-DNOHZ68U8hZfKXOrtjWvjxusGo9WQnrNx2sqG0tfsghAvtVlRW3tvkXWZh58N9jp" crossorigin="anonymous"/>
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

                <style jsx>{`${styles}`}</style>
            </>
        )
    }
}

export default Main