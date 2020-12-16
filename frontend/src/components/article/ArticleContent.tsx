import Router from 'next/router';

function onInnerLinkClickEvent(this: HTMLAnchorElement, e: any) {
    if(this.href.includes(`${location.protocol}//${location.host}/`)) {
        e.preventDefault();
        Router.push(this.href).then(() => window.scrollTo(0, 0));
    }
}

export default function ArticleContent(props: {
    html: string;
}) {
    if(typeof window !== "undefined") {
        document.querySelectorAll('.article a').forEach(element => {
            element.addEventListener('click', onInnerLinkClickEvent);
        });
    }
    return (
        <div
            className="article noto"
            dangerouslySetInnerHTML={{ __html: props.html }}>
        </div>
    )
}