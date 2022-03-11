import styles from './ArticleContent.module.scss';

import { useState, useEffect } from 'react';
import Router from 'next/router';

import { configStore } from '@stores/config';

export interface ArticleContentProps {
    html: string;
    isEdit?: boolean;
}

export function ArticleContent(props: ArticleContentProps) {
    const [
        isOpenNewTab,
        setIsOpenNewTab
    ] = useState(configStore.state.isOpenNewTab);

    useEffect(configStore.syncValue('isOpenNewTab', setIsOpenNewTab), []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handleClickAnchorTag = (e: any) => {
                if (e.target.nodeName === 'A') {
                    const { href } = e.target;

                    if (isOpenNewTab || props.isEdit) {
                        e.preventDefault();
                        window.open(href, '_blank');
                        return;
                    }

                    if(href.includes(`${location.protocol}//${location.host}/`)) {
                        e.preventDefault();
                        Router.push(href).then(() => window.scrollTo(0, 0));
                        return;
                    }
                }
            }
            
            const $article = document.querySelector(`.${styles.article}`);

            $article?.addEventListener('click', handleClickAnchorTag);
            return () => {
                $article?.removeEventListener('click', handleClickAnchorTag);
            }
        }
    }, [isOpenNewTab]);

    return (
        <div
            className={styles.article}
            dangerouslySetInnerHTML={{ __html: props.html }}
        />
    )
}