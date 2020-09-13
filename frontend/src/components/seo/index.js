export default function SEO(props) {
    let defaultTag = [];
    let openGraphTag = [];
    let twitterTag = [];

    twitterTag.push(<meta name="twitter:card" content="summary"/>);

    if(props.type) {
        openGraphTag.push(<meta property="og:type" content={props.type}/>);
    }

    if(props.type) {
        if(props.author) {
            twitterTag.push(<meta name="twitter:title" content={`${props.title} — ${props.author}`}/>);
            openGraphTag.push(<meta property="og:title" content={`${props.title} — ${props.author}`}/>);
        } else {
            twitterTag.push(<meta name="twitter:title" content={props.title}/>);
            openGraphTag.push(<meta property="og:title" content={props.title}/>);
        }
    }

    if(props.description) {
        defaultTag.push(<meta name="description" content={props.description}/>);
        twitterTag.push(<meta name="twitter:description" content={props.description}/>);
        openGraphTag.push(<meta property="og:description" content={props.description}/>);
    }

    if(props.author) {
        defaultTag.push(<meta name="author" content={props.author}/>);
    }

    if(props.keywords) {
        defaultTag.push(<meta name="keywords" content={props.keywords}/>);
    }

    if(props.url) {
        twitterTag.push(<meta name="twitter:url" content={props.url}/>);
        openGraphTag.push(<meta property="og:url" content={props.url}/>);
    }

    if(props.image) {
        twitterTag.push(<meta name="twitter:image" content={props.image}/>);
        openGraphTag.push(<meta property="og:image" content={props.image}/>);
    }

    openGraphTag.push(<meta property="og:locale" content="ko_KR"/>);
    
    return (
        <>
            {defaultTag}
            {openGraphTag}
            {twitterTag}
        </>
    )
}