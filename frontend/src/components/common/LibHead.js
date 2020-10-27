import Head from 'next/head';

import Config from '../../modules/config.json';

export default function() {
    return (
        <Head>
            <link
                rel="stylesheet"
                href="https://use.fontawesome.com/releases/v5.0.13/css/all.css"
                integrity="sha384-DNOHZ68U8hZfKXOrtjWvjxusGo9WQnrNx2sqG0tfsghAvtVlRW3tvkXWZh58N9jp"
                crossOrigin="anonymous"/>
            <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css?family=Noto+Serif+KR|Noto+Sans+KR|Black+Han+Sans"/>
            <link
                rel="stylesheet"
                href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css"
                integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk"
                crossOrigin="anonymous"
            />
            {Config.GOOGLE_ANALYTICS_V4 ? (
                <>
                    <script async src="https://www.googletagmanager.com/gtag/js?id=G-VD3ZLTR4ZQ"></script>
                    <script dangerouslySetInnerHTML={{ __html: `
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());

                        gtag('config', '${Config.GOOGLE_ANALYTICS_V4}');
                    `}}/>
                </>
            ) : ''}
            {Config.GOOGLE_ADSENSE ? (
                <script data-ad-client={`${Config.GOOGLE_ADSENSE}`} async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"/>
            ) : ''}
        </Head>
    )
}