import Head from 'next/head'

export default function SEO(props) {
    let defaultTag = [];
    let openGraphTag = [];
    let twitterTag = [];

    let key = 0;

    if(props.title) {
        if(props.author) {
            twitterTag.push(<meta key={key++} name="twitter:title" content={`${props.title} — ${props.author}`}/>);
            openGraphTag.push(<meta key={key++} property="og:title" content={`${props.title} — ${props.author}`}/>);
        } else {
            twitterTag.push(<meta key={key++} name="twitter:title" content={props.title}/>);
            openGraphTag.push(<meta key={key++} property="og:title" content={props.title}/>);
        }
    }

    if(props.description) {
        defaultTag.push(<meta key={key++} name="description" content={props.description}/>);
        twitterTag.push(<meta key={key++} name="twitter:description" content={props.description}/>);
        openGraphTag.push(<meta key={key++} property="og:description" content={props.description}/>);
    }

    if(props.author) {
        defaultTag.push(<meta key={key++} name="author" content={props.author}/>);
    }

    if(props.keywords) {
        defaultTag.push(<meta key={key++} name="keywords" content={props.keywords}/>);
    }

    if(props.url) {
        twitterTag.push(<meta key={key++} name="twitter:url" content={props.url}/>);
        openGraphTag.push(<meta key={key++} property="og:url" content={props.url}/>);
    }

    if(props.image) {
        twitterTag.push(<meta key={key++} name="twitter:image" content={props.image}/>);
        openGraphTag.push(<meta key={key++} property="og:image" content={props.image}/>);
    }

    if(props.isArticle) {
        twitterTag.push(<meta key={key++} name="twitter:card" content="summary"/>);
        openGraphTag.push(<meta key={key++} property="og:type" content="blog"/>);
    }
    openGraphTag.push(<meta key={key++} property="og:locale" content="ko_KR"/>);
    
    return (
        <Head>
            {defaultTag}
            {openGraphTag}
            {twitterTag}
        </Head>
    )
}