import classNames from 'classnames/bind';
import styles from './ArticleContent.module.scss';
const cn = classNames.bind(styles);

import React, { useEffect, useRef } from 'react';
import Router from 'next/router';

import { codeMirrorAll } from '~/modules/library/codemirror';
import { lazyLoadResource } from '~/modules/optimize/lazy';

export interface ArticleContentProps {
    renderedContent: string;
}

export function ArticleContent({ renderedContent }: ArticleContentProps) {
    const ref = useRef<HTMLDivElement>(null);

    const handleClickContent = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLAnchorElement) {
            const { href } = e.target as HTMLAnchorElement;
            const isSameOrigin = href.includes(`${location.protocol}//${location.host}/`);

            if (isSameOrigin) {
                e.preventDefault();
                Router.push(href).then(() => window.scrollTo(0, 0));
                return;
            }

            e.preventDefault();
            window.open(href, '_blank');
            return;
        }
    };

    useEffect(() => {
        if (ref.current) {
            codeMirrorAll(ref.current);
            lazyLoadResource(ref.current);
        }
    }, [ref, renderedContent]);

    return (
        <div
            ref={ref}
            className={cn('article')}
            onClick={handleClickContent}
            dangerouslySetInnerHTML={{
                __html: renderedContent
            }}
        />
    );
}
