import Head from 'next/head';

export interface SEOProps {
    title?: string;
    author?: string;
    description?: string;
    keywords?: string;
    url?: string;
    image?: string;
    isArticle?: boolean;
}

export function SEO(props: SEOProps) {
    const deTag = [];
    const ogTag = [];
    const twTag = [];

    let key = 0;

    if (props.title) {
        twTag.push(<meta key={key++} name="twitter:title" content={props.title}/>);
        ogTag.push(<meta key={key++} property="og:title" content={props.title}/>);
    }

    if (props.description) {
        deTag.push(<meta key={key++} name="description" content={props.description}/>);
        twTag.push(<meta key={key++} name="twitter:description" content={props.description}/>);
        ogTag.push(<meta key={key++} property="og:description" content={props.description}/>);
    }

    if (props.author) {
        deTag.push(<meta key={key++} name="author" content={props.author}/>);
    }

    if (props.keywords) {
        deTag.push(<meta key={key++} name="keywords" content={props.keywords}/>);
    }

    if (props.url) {
        twTag.push(<meta key={key++} name="twitter:url" content={props.url}/>);
        ogTag.push(<meta key={key++} property="og:url" content={props.url}/>);
    }

    if (props.image) {
        twTag.push(<meta key={key++} name="twitter:image" content={props.image}/>);
        ogTag.push(<meta key={key++} property="og:image" content={props.image}/>);
    }

    if (props.isArticle) {
        twTag.push(<meta key={key++} name="twitter:card" content="summary"/>);
        ogTag.push(<meta key={key++} property="og:type" content="blog"/>);
    }
    ogTag.push(<meta key={key++} property="og:locale" content="ko_KR"/>);

    return (
        <Head>
            {props.title && (
                <title>{props.title}</title>
            )}
            {deTag}
            {ogTag}
            {twTag}
        </Head>
    );
}
