import { useState } from 'react';
import Router from 'next/router';
import { toast } from 'react-toastify';

import EditorLayout from '@components/editor/Layout';

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
        
        const posts = (await API.getPost(author as string, posturl as string, 'edit', cookie)).data;
    
        return {
            props: {
                posturl: posturl,
                username: author,
                ...posts
            }
        };
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface PostsEditData {
    image: string;
    title: string;
    series: string;
    textMd: string;
    tag: string;
    isHide: boolean;
    isAdvertise: boolean;
}

interface Props extends PostsEditData {
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
    const [ isAdvertise, setIsAdvertise ] = useState(props.isAdvertise);

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
            formData.append('is_hide', JSON.stringify(isHide));
            formData.append('is_advertise', JSON.stringify(isAdvertise));

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
            isAdvertise={{
                value: isAdvertise,
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