import styles from './ArticleContent.module.scss';

import { useState, useEffect } from 'react';
import Router from 'next/router';

import { configContext } from '@state/config';

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

export function ArticleContent(props: {
    html: string;
    isEdit?: boolean;
}) {
    const [ isOpenNewTab, setIsOpenNewTab ] = useState(configContext.state.isOpenNewTab);

    useEffect(() => {
        const updateKey = configContext.appendUpdater((state) => {
            setIsOpenNewTab(state.isOpenNewTab);
        });

        return () => configContext.popUpdater(updateKey);
    }, []);

    useEffect(() => {
        if(typeof window !== "undefined") {
            Array.from(document.querySelectorAll(`.${styles.article} a`)).forEach(element => {
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
            className={styles.article}
            dangerouslySetInnerHTML={{ __html: props.html }}>
        </div>
    )
}