import { http, Response } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import { getStaticPath } from '~/modules/env.module';

interface CommentsProps {
    postUrl: string;
}

interface Comment {
    id: number;
    author: string;
    authorImage: string;
    renderedContent: string;
    isEdited: boolean;
    createdDate: string;
    countLikes: number;
    hasLiked: boolean;
}

const Comments = (props: CommentsProps) => {
    const { postUrl } = props;

    const { data, isError, isLoading } = useFetch({
        queryKey: [postUrl, 'comments'],
        queryFn: () => http<Response<{ comments: Comment[] }>>(`v1/posts/${postUrl}/comments`, {
            method: 'GET',
        }),
        enable: !!postUrl,
    });

    if (isError) {
        return <p>Error loading comments</p>;
    }

    if (isLoading) {
        return <p>Loading comments...</p>;
    }

    return (
        <>
            <ul className="comments-list">
                {data?.data.body.comments.map((comment) => (
                    <li key={comment.id} className="comment-item">
                        <div className="comment-header">
                            <img
                                src={getStaticPath(comment.authorImage)}
                                alt={comment.author}
                                className="author-image"
                            />
                            <div className="author-info">
                                <span className="author-name">{comment.author}</span>
                                <span className="comment-date">{comment.createdDate}</span>
                            </div>
                        </div>
                        <div className="comment-body">
                            {/* Use dangerouslySetInnerHTML in its own div */}
                            <div
                                className="comment-content"
                                dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                            />
                            <div className="comment-actions">
                                <button className="like-button">Like</button>
                                <span className="like-count">{comment.countLikes}</span>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            <style jsx>{`
                .comments-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .comment-item {
                    margin-bottom: 20px;
                    padding: 15px;
                    border-radius: 8px;
                    background-color: #f8f9fa;
                }
                
                .comment-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .author-image {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    margin-right: 10px;
                }
                
                .author-info {
                    display: flex;
                    flex-direction: column;
                }
                
                .author-name {
                    font-weight: 600;
                    font-size: 14px;
                }
                
                .comment-date {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .comment-body {
                    margin-left: 50px;
                }
                
                .comment-content {
                    margin-bottom: 10px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                
                .comment-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 10px;
                }
                
                .like-button {
                    background: none;
                    border: none;
                    color: #6c757d;
                    cursor: pointer;
                    padding: 5px 10px;
                    font-size: 12px;
                    border-radius: 4px;
                    background-color: #e9ecef;
                }
                
                .like-count {
                    font-size: 12px;
                    color: #6c757d;
                }
            `}</style>
        </>
    );
};

export default Comments;
