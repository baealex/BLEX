import { useEffect, useState } from 'react';
import { http } from '~/modules/http.module';

interface CommentsProps {
    postUrl: string;
}

const Comments = (props: CommentsProps) => {
    const { postUrl } = props;
    const [comments, setComments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const response = await http(`v1/posts/${postUrl}/comments`, {
                method: 'GET',
            });

            if (response.status === 200) {
                const data = response.data;
                setComments(data.body.comments);
            } else {
                console.error('Failed to fetch comments');
            }
        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [postUrl]);

    return (
        <div>
            <h1>Comments</h1>
            {isLoading ? (
                <p>Loading comments...</p>
            ) : (
                <ul>
                    {comments.map((comment) => (
                        <li key={comment.id} dangerouslySetInnerHTML={{ __html: comment.renderedContent }}></li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Comments;
