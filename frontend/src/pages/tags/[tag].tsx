import Head from 'next/head';
import Link from 'next/link';

import { ArticleCard } from '@components/article';
import {
    Footer,
    Pagination,
    SpeechBubble,
    SEO,
    Text,
} from '@components/integrated';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';
import { getUserImage } from '@modules/image';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        tag,
        page = 1
    } = context.query;
    
    try {
        const { data } = await API.getTag(tag as string, Number(page));
        return {
            props: {
                ...data.body,
                page,
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props extends API.GetTagData {
    page: number;
}

export default function TagDetail(props: Props) {
    return (
        <>
            <Head>
                <title>{props.tag} —  BLEX</title>
            </Head>
            <SEO
                title={props.tag}
                image="https://static.blex.me/assets/images/default-post.png"
                description={`블렉스에서 '${props.tag}' 주제로 작성된 모든 포스트 만나보세요.`}
            />
            <div className="container">
                <Text fontSize={8} fontWeight={600}>— {props.tag} —</Text>
                {props.desc.url && (
                    <div className="mt-3">
                        <SpeechBubble username={props.desc.author} userImage={getUserImage(props.desc.authorImage)}>
                            <>
                                {props.desc.description}
                                <Link href={`/@${props.desc.author}/${props.desc.url}`}>
                                    <a className="ml-1 shallow-dark">
                                        더보기
                                    </a>
                                </Link>
                            </>
                        </SpeechBubble>
                    </div>
                )}
                <div className="row">
                    {props.posts.map((item, idx) => (
                        <ArticleCard 
                            key={idx}
                            className="col-lg-4 col-md-6 mt-4"
                            {...item}
                        />
                    ))}
                </div>
                <Pagination
                    page={props.page}
                    last={props.lastPage}
                />
            </div>
            <Footer/>
        </>
    )
}