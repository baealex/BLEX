import { useState } from 'react';
import Router from 'next/router';
import { toast } from 'react-toastify';

import { Layout } from '@components/editor';

import * as API from '@modules/api';
import blexer from '@modules/blexer'

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
    const [ tags, setTags ] = useState(props.tag);
    const [ isHide, setIsHide ] = useState(props.isHide);
    const [ isAd, setIsAdvertise ] = useState(props.isAd);

    const onSubmit = async (onFail: Function) => {
        if(!title) {
            toast('😅 제목이 비어있습니다.');
            onFail();
            return;
        }
        if(!tags) {
            toast('😅 키워드를 작성해주세요.');
            onFail();
            return;
        }
        try {
            const { data } = await API.postAnUserPosts(props.username, props.posturl, {
                title: title,
                text_md: content,
                text_html: blexer(content),
                image: imageFile,
                tag: tags,
                series,
                is_hide: JSON.stringify(isHide),
                is_advertise: JSON.stringify(isAd),
            });
            if(data.status === 'DONE') {
                Router.push('/[author]/[posturl]', `/${props.username}/${props.posturl}`);
            }
        } catch(e) {
            toast('😥 글 수정중 오류가 발생했습니다.');
            onFail();
        }
    }
    
    return (
        <Layout
            title={{
                value: title,
                onChange: (value) => setTitle(value),
            }}
            content={{
                value: content,
                onChange: (value) => setContent(value),
            }}
            series={{
                value: series,
                onChange: (value) => setSeries(value),
            }}
            tags={{
                value: tags,
                onChange: (value) => setTags(value),
            }}
            isHide={{
                value: isHide,
                onChange: (value) => setIsHide(value)
            }}
            isAd={{
                value: isAd,
                onChange: (value) => setIsAdvertise(value)
            }}
            image={{
                onChange: (image) => {
                    imageFile = image;
                    console.log(imageFile);
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