import Link from 'next/link';

import { getPostsImage } from '@modules/utility/image';

export interface SeriesArticleCardProps {
    idx: number;
    author: string;
    url: string;
    title: string;
    image: string;
    description: string;
    createdDate: string;
    readTime: number;
}

export function SeriesArticleCard(props: SeriesArticleCardProps) {
    return (
        <>
            <div className="box">
                <Link href={`/@${props.author}/${props.url}`}>
                    <a>
                        <img
                            className="thumbnail lazy"
                            src={getPostsImage(props.image, {
                                preview: true 
                            })}
                            data-src={getPostsImage(props.image, {
                                minify: true,
                            })}
                        />
                        <div className="mask">
                            <div className="title">
                                {props.idx + 1}. {props.title}
                            </div>
                            <div className="describe">
                                {props.description}
                            </div>
                        </div>
                    </a>
                </Link>
            </div>
            <style jsx>{`
                .box {
                    position: relative;
                    width: 100%;
                    height: 250px;
                    margin-bottom: 16px;

                    .thumbnail, .mask {
                        border-radius: 16px;
                    }

                    .thumbnail {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }

                    .mask {
                        background:linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.85));
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        top: 0;
                        left: 0;

                        :global(body.dark) & {
                            background:linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.85));
                        }

                        .title, .describe {
                            position: absolute;
                            left: 24px;
                            right: 24px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }

                        .title {
                            color: #fff;
                            font-size: 16px;
                            font-weight: 600;
                            bottom: 48px;
                        }

                        .describe {
                            color: #ccc;
                            bottom: 24px;
                            font-size: 14px;
                            
                        }
                    }
                }
            `}</style>
        </>
    );
}

/*

<Card hasShadow isRounded className="mb-4">
            <img src={getPostsImage(props.image)} style={{
                maxWidth: '100%'
            }}/>
            <div className="p-3">
                <h5 className="card-title font-weight-bold">
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a className="deep-dark">{props.idx + 1}. {props.title}</a>
                    </Link>
                </h5>
                <p>
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a className="shallow-dark">{props.description}</a>
                    </Link>
                </p>
                <p className="vs">{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span></p>
            </div>
        </Card>

 */