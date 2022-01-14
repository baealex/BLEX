import { useState } from 'react';
import Router from 'next/router';

import { Layout } from '@components/editor';

import * as API from '@modules/api';
import {
    snackBar
} from '@modules/ui/snack-bar';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req } = context;
    const {
        author = '',
        posturl = ''
    } = context.query;

    if(!author.includes('@') || !posturl) {
        return {
            notFound: true
        };
    }

    try {
        const cookie = req.headers.cookie;
        
        const posts = (await API.getAnUserPostsEdit(
            author as string,
            posturl as string,
            cookie)
        ).data;
    
        return {
            props: {
                posturl: posturl,
                username: author,
                ...posts.body
            }
        };
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props extends API.GetAnUserPostsEditData {
    posturl: string;
    username: string;
}

let imageFile: File | undefined;

export default function Edit(props: Props) {
    const [ title, setTitle ] = useState(props.title);
    const [ content, setContent ] = useState(props.textMd);
    const [ series, setSeries ] = useState(props.series);
    const [ tags, setTags ] = useState(props.tags.join(','));
    const [ isHide, setIsHide ] = useState(props.isHide);
    const [ isAdvertise, setIsAdvertise ] = useState(props.isAdvertise);

    const onSubmit = async (onFail: Function) => {
        if(!title) {
            snackBar('😅 제목이 비어있습니다.');
            onFail();
            return;
        }
        if(!tags) {
            snackBar('😅 키워드를 작성해주세요.');
            onFail();
            return;
        }
        try {
            const { data } = await API.postAnUserPosts(props.username, props.posturl, {
                title: title,
                text_md: content,
                image: imageFile,
                tag: tags,
                series,
                is_hide: JSON.stringify(isHide),
                is_advertise: JSON.stringify(isAdvertise),
            });
            if(data.status === 'DONE') {
                Router.push('/[author]/[posturl]', `/${props.username}/${props.posturl}`);
            }
        } catch(e) {
            snackBar('😥 글 수정중 오류가 발생했습니다.');
            onFail();
        }
    }
    
    return (
        <Layout
            title={{
                value: title,
                onChange: setTitle,
            }}
            content={{
                value: content,
                onChange: setContent,
            }}
            series={{
                value: series,
                onChange: setSeries,
            }}
            tags={{
                value: tags,
                onChange: setTags,
            }}
            isHide={{
                value: isHide,
                onChange: setIsHide,
            }}
            isAd={{
                value: isAdvertise,
                onChange: setIsAdvertise,
            }}
            image={{
                onChange: (image) => {
                    imageFile = image;
                }
            }}
            publish={{
                title: "포스트 수정",
                buttonText: "이렇게 수정하겠습니다"
            }}
            onSubmit={onSubmit}
        />
    )
}