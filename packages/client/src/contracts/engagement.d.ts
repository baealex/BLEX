export interface CommentPayload {
    id: number;
    author: string;
    authorImage: string | null;
    isMine: boolean;
    isEdited: boolean;
    isDeleted: boolean;
    renderedContent: string;
    createdDate: string;
    countLikes: number;
    isLiked: boolean;
    permissions: {
        canEdit: boolean;
        canDelete: boolean;
        canLike: boolean;
        canReply: boolean;
    };
    parentId?: number;
    replies?: CommentPayload[];
}

export interface ReaderAuthorHeader {
    id: number;
    username: string;
    name: string;
    avatar: string;
    cover: string | null;
    bio: string;
    homepage: string;
    social: Array<{ id: number; name: string; value: string; order: number }>;
    canSubscribe: boolean;
    isSubscribed: boolean;
}

export interface ReaderPostLikeState {
    countLikes: number;
    isLiked: boolean;
    canLike: boolean;
}

export interface ReaderPostView {
    slug: string;
    viewerAuthenticated: boolean;
    postLike: ReaderPostLikeState;
    author: ReaderAuthorHeader;
    canComment: boolean;
    comments: CommentPayload[];
}
