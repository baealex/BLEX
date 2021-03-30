import { useState } from 'react';
import Router from 'next/router';
import { toast } from 'react-toastify';

import EditorLayout from '@components/editor/Layout';

import * as API from '@modules/api';
import blexer from '@modules/blexer'

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const raise = require('@modules/raise');

    const { req, res } = context;
    const { author = '', posturl = '' } = context.query;

    if(!author.includes('@') || !posturl) {
        raise.Http404(res);
    }

    try {
        const cookie = req.headers.cookie;
        
        const posts = (await API.getPost(author as string, posturl as string, 'edit', cookie)).data;
        const { series } = (await API.getSetting(cookie, 'series')).data;
    
        return {
            props: {
                posturl: posturl,
                username: author,
                seriesArray: series,
                ...posts
            }
        };
    } catch(error) {
        raise.auto(error.response.status, res);
    }
}

interface PostsEditData {
    image: string;
    title: string;
    series: string;
    textMd: string;
    tag: string;
    isHide: string;
}

interface Props extends PostsEditData {
    posturl: string;
    username: string;
    seriesArray: {
        url: string;
        title: string;
    }[];
}

let imageFile: File | undefined;

export default function Edit(props: Props) {
    const [ title, setTitle ] = useState(props.title);
    const [ content, setContent ] = useState(props.textMd);
    const [ series, setSeries ] = useState(props.series);
    const [ tags, setTags ] = useState(props.tag);

    const onSubmit = async () => {
        if(!title) {
            toast('😅 제목이 비어있습니다.');
            return;
        }
        if(!tags) {
            toast('😅 키워드를 작성해주세요.');
            return;
        }
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('text_md', content);
            formData.append('text_html', blexer(content));
            if(imageFile) {
                formData.append('image', imageFile);
            }
            formData.append('tag', tags);
            formData.append('series', series);

            const { data } = await API.editPost(props.username, props.posturl, formData);
            if(data == 'DONE') {
                Router.push('/[author]/[posturl]', `/${props.username}/${props.posturl}`);
            }
        } catch(e) {
            toast('😥 글 수정중 오류가 발생했습니다.');
        }
    }
    
    return (
        <EditorLayout
            title={{
                value: title,
                onChange: (value: string) => setTitle(value),
            }}
            content={{
                value: content,
                onChange: (value: string) => setContent(value),
            }}
            series={{
                list: props.seriesArray,
                value: series,
                onChange: (value: string) => setSeries(value),
            }}
            tags={{
                value: tags,
                onChange: (value: string) => setTags(value),
            }}
            image={{
                onChange: (image: File) => {
                    imageFile = image;
                    console.log(imageFile);
                }
            }}
            publish={{
                title: "포스트 수정",
                buttonText: "이렇게 수정하겠습니다"
            }}
            onSubmit={onSubmit}
        ></EditorLayout>
    )
}