import Document, {
    DocumentContext,
    Head,
    Html,
    Main,
    NextScript
} from 'next/document';

class MyDocument extends Document {
    static async getInitialProps(ctx: DocumentContext) {
        const initialProps = await Document.getInitialProps(ctx);
        return {
            ...initialProps 
        };
    }

    render() {
        return (
            <Html lang="ko">
                <Head>
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
                        crossOrigin="anonymous"
                    />
                </Head>

                <body>
                    <Main/>
                    <NextScript/>
                </body>
            </Html>
        );
    }
}

export default MyDocument;