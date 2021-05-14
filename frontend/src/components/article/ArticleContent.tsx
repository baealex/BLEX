import { useState, useEffect } from 'react';
import Router from 'next/router';

import Global from '@modules/global'

function onInnerLinkClickEvent(this: HTMLAnchorElement, e: any) {
    if(this.href.includes(`${location.protocol}//${location.host}/`)) {
        e.preventDefault();
        Router.push(this.href).then(() => window.scrollTo(0, 0));
    }
}

function onNewTabLinkClickEvent(this: HTMLAnchorElement, e: any) {
    e.preventDefault();
    window.open(this.href, '_blank');
}

export default function ArticleContent(props: {
    html: string;
    isEdit?: boolean;
}) {
    const [ isOpenNewTab, setIsOpenNewTab ] = useState(Global.state.isOpenNewTab);

    useEffect(() => {
        Global.appendUpdater('ArticleContentIsOpenNewTab', () => {
            setIsOpenNewTab(Global.state.isOpenNewTab);
        });

        return () => Global.popUpdater('ArticleContentIsOpenNewTab');
    }, []);

    useEffect(() => {
        if(typeof window !== "undefined") {
            document.querySelectorAll('.article a').forEach(element => {
                if(isOpenNewTab || props.isEdit) {
                    element.removeEventListener('click', onInnerLinkClickEvent);
                    element.addEventListener('click', onNewTabLinkClickEvent);
                } else {
                    element.removeEventListener('click', onNewTabLinkClickEvent);
                    element.addEventListener('click', onInnerLinkClickEvent);
                }
            });
        }
    }, [isOpenNewTab, props.html]);

    return (
        <div
            className="article noto"
            dangerouslySetInnerHTML={{ __html: props.html }}>
        </div>
    )
}