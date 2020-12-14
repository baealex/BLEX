import Head from 'next/head';

import Config from '../../modules/config.json';

function minify(str: string) {
    str = str.replace(/\s/g, '');
    str = str.replace(/function/g, 'function ');
    str = str.replace(/var/g, 'var ');
    str = str.replace(/new/g, 'new ');
    return str;
}

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
                href="https://fonts.googleapis.com/css?family=Noto+Serif+KR|Noto+Sans+KR"/>
            <link
                rel="stylesheet"
                href="https://static.blex.me/assets/css/bootstrap.min.css"
            />
            <link
                rel="stylesheet"
                href="https://static.blex.me/assets/css/three-dots.min.css"
            />
            {Config.GOOGLE_ANALYTICS_V4 ? (
                <>
                    <script async src="https://www.googletagmanager.com/gtag/js?id=G-VD3ZLTR4ZQ"></script>
                    <script dangerouslySetInnerHTML={{ __html: minify(`
                        window.dataLayer = window.dataLayer || [];
                        function gtag() {
                            dataLayer.push(arguments);
                        }
                        gtag('js', new Date());
                        gtag('config', '${Config.GOOGLE_ANALYTICS_V4}');
                    `)}}/>
                </>
            ) : ''}
            {Config.MICROSOFT_CLARITY ? (
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
                    })(window, document, "clarity", "script", "${Config.MICROSOFT_CLARITY}");
                `)}}/>
            ): ''}
        </Head>
    )
}